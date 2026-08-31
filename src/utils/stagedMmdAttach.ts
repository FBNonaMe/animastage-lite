import type { MMDAnimationHelper } from 'three-stdlib';
import * as THREE from 'three';
import {
  beginPhysicsBootstrap,
  endPhysicsBootstrap,
  scheduleAfterMs,
  runWhenIdle,
} from '../perf/modelLoadProfile';
import { startPhysicsLoadCooldown } from '../physics/physicsFrameGate';
import {
  applyIkFixOnly,
  applyPhysicsLiveSettings,
  configureArmPhysicsForAnimation,
  getPhysicsAddParams,
  isAmmoPhysicsBroken,
  markAmmoPhysicsBroken,
} from './mmdCharacterPhysics';
import { countMeshRigidBodies, evaluatePhysicsEligibility, isAmmoOomError } from '../physics/physicsEligibility';
import { restartMeshPhysics } from './mmdPhysicsLifecycle';
import { initAmmo, isAmmoInitialized } from './ammoLoader';
import { registerScenePhysics } from '../scene/scenePhysicsRegistry';
import type { MMDPhysics } from 'three-stdlib';

const STAGE_MS = {
  afterAdd: 16,
  animation: 16,
  ik: 16,
  physics: 16,
  materials: 16,
} as const;

export type StagedAttachContext = {
  helper: MMDAnimationHelper;
  mesh: THREE.SkinnedMesh;
  animation?: THREE.AnimationClip;
  physicsMode: 'anytime' | 'playtime' | 'off';
  isCurrent: () => boolean;
  onStagedReady: () => void;
  /** Fires when background Jolt init finishes (or fails). */
  onPhysicsStageComplete?: () => void;
  /** Called right after helper.add — scene is interactive before physics finishes. */
  onHelperAttached?: () => void;
  onAnimationReady?: () => void;
  onFinalizeMaterials: () => void;
  bindRigidBodies: (mesh: THREE.SkinnedMesh) => void;
  configureHelper: (helper: MMDAnimationHelper, mesh: THREE.SkinnedMesh) => void;
  syncSkeleton: (mesh: THREE.SkinnedMesh) => void;
  getHelperMeshState: (
    helper: MMDAnimationHelper,
    mesh: THREE.SkinnedMesh
  ) => { physics?: { reset: () => void; createHelper: () => THREE.Object3D } } | undefined;
};

/**
 * Staged helper attach: mesh in helper → animation → IK → physics (idle) → materials.
 * Loading overlay is dismissed separately when textures are ready.
 */
export function runStagedMmdAttach(ctx: StagedAttachContext): () => void {
  const {
    helper,
    mesh,
    animation,
    physicsMode,
    isCurrent,
    onStagedReady,
    onPhysicsStageComplete,
    onHelperAttached,
    onAnimationReady,
    onFinalizeMaterials,
    bindRigidBodies,
    configureHelper,
    syncSkeleton,
    getHelperMeshState,
  } = ctx;

  const cancels: Array<() => void> = [];
  const schedule = (ms: number, work: () => void) => {
    cancels.push(scheduleAfterMs(ms, work, () => !isCurrent()));
  };

  let meshAttached = false;
  let unregisterScenePhysics: (() => void) | null = null;

  bindRigidBodies(mesh);
  configureHelper(helper, mesh);

  try {
    helper.add(
      mesh,
      getPhysicsAddParams(false, undefined, { animation }) as unknown as Parameters<
        MMDAnimationHelper['add']
      >[1]
    );
    meshAttached = true;
    onHelperAttached?.();
  } catch (err) {
    if (isAmmoOomError(err)) {
      markAmmoPhysicsBroken(err);
    }
    console.warn('[MMD] helper.add failed, retrying without physics:', err);
    try {
      helper.add(
        mesh,
        getPhysicsAddParams(false, undefined, { animation }) as unknown as Parameters<
          MMDAnimationHelper['add']
        >[1]
      );
      meshAttached = true;
      onHelperAttached?.();
    } catch (retryErr) {
      console.error('[MMD] helper.add failed:', retryErr);
      onStagedReady();
      return () => cancels.forEach((c) => c());
    }
  }

  helper.enable('animation', false);
  helper.enable('ik', false);
  helper.enable('grant', false);
  helper.enable('physics', false);
  syncSkeleton(mesh);

  const finishStaged = () => {
    onFinalizeMaterials();
    schedule(STAGE_MS.materials, () => {
      onStagedReady();
    });
  };

  const runPhysicsStage = () => {
    if (!isCurrent()) return;
    beginPhysicsBootstrap();

    const eligibility = evaluatePhysicsEligibility(mesh);
    const physicsEnabled =
      meshAttached &&
      isAmmoInitialized() &&
      !isAmmoPhysicsBroken() &&
      physicsMode !== 'off' &&
      eligibility.allowed;

    if (!eligibility.allowed && physicsMode !== 'off') {
      console.info(
        `[MMD] Physics skipped (${eligibility.reason}, ${eligibility.rigidBodyCount} bodies)`
      );
    }

    const finishPhysicsStage = () => {
      try {
        let meshState = getHelperMeshState(helper, mesh);
        const simNow = physicsEnabled && physicsMode === 'anytime';
        helper.enable('physics', simNow && Boolean(meshState?.physics));
        if (meshState?.physics && physicsEnabled) {
          applyPhysicsLiveSettings(
            meshState.physics as Parameters<typeof applyPhysicsLiveSettings>[0]
          );
          configureArmPhysicsForAnimation(mesh, helper);
          meshState.physics.reset();
          unregisterScenePhysics?.();
          unregisterScenePhysics = registerScenePhysics(meshState.physics as MMDPhysics);
          startPhysicsLoadCooldown(12);
        }
        syncSkeleton(mesh);
      } catch (err) {
        console.warn('[MMD] Physics setup failed (scene remains usable):', err);
        helper.enable('physics', false);
      } finally {
        onPhysicsStageComplete?.();
        endPhysicsBootstrap();
      }
    };

    schedule(STAGE_MS.physics, () => {
      if (!isCurrent()) {
        endPhysicsBootstrap();
        return;
      }
      try {
        let meshState = getHelperMeshState(helper, mesh);
        if (physicsEnabled && !meshState?.physics) {
          const prior = meshState as { activeClip?: THREE.AnimationClip } | undefined;
          restartMeshPhysics({
            helper,
            mesh,
            clip: animation ?? prior?.activeClip ?? null,
            physicsEnabled: true,
          });
        }
      } catch (err) {
        if (isAmmoOomError(err)) markAmmoPhysicsBroken(err);
        console.warn('[MMD] Physics bootstrap failed:', err);
        helper.enable('physics', false);
        onPhysicsStageComplete?.();
        endPhysicsBootstrap();
        return;
      }
      schedule(STAGE_MS.physics, finishPhysicsStage);
    });
  };

  schedule(STAGE_MS.afterAdd, () => {
    if (!isCurrent()) return;
    if (animation) {
      helper.enable('animation', true);
      onAnimationReady?.();
    }

    schedule(STAGE_MS.animation, () => {
      if (!isCurrent()) return;
      applyIkFixOnly(mesh, helper);
      helper.enable('ik', true);
      helper.enable('grant', true);
      syncSkeleton(mesh);

      schedule(STAGE_MS.ik, () => {
        if (!isCurrent()) return;
        // Pose + VMD before physics idle — model is usable without pressing Play.
        finishStaged();

        void initAmmo()
          .catch((err) => {
            console.warn('[MMD] Ammo unavailable — physics disabled:', err);
          })
          .finally(() => {
            if (!isCurrent()) return;
            runWhenIdle(runPhysicsStage, 500);
          });
      });
    });
  });

  return () => {
    cancels.forEach((c) => c());
    unregisterScenePhysics?.();
    unregisterScenePhysics = null;
  };
}
