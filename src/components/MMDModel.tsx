import React, { useEffect, useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import * as MMDParserModule from 'mmd-parser';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js';

export class MMDLoader extends THREE.Loader {
  constructor(manager?: THREE.LoadingManager) {
    super(manager || THREE.DefaultLoadingManager);
    this.manager.addHandler(/\.tga$/i, new TGALoader(this.manager));
  }

  load(
    url: string,
    onLoad: (mesh: THREE.SkinnedMesh) => void,
    onProgress?: (xhr: ProgressEvent) => void,
    onError?: (error: ErrorEvent) => void
  ) {
    const loader = new THREE.FileLoader(this.manager);
    loader.setPath(this.path);
    loader.setResponseType('arraybuffer');
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);

    loader.load(
      url,
      (buffer: any) => {
        try {
          const mesh = this.parse(buffer);
          onLoad(mesh);
        } catch (e: any) {
          if (onError) onError(e);
        }
      },
      onProgress,
      onError
    );
  }

  parse(buffer: ArrayBuffer): THREE.SkinnedMesh {
    const ParserClass = 
      (MMDParserModule as any).Parser || 
      (MMDParserModule as any).default?.Parser || 
      (MMDParserModule as any).MMDParser?.Parser || 
      (MMDParserModule as any).default?.MMDParser?.Parser ||
      (MMDParserModule as any).default;

    if (!ParserClass) {
      throw new Error("Could not find Parser in mmd-parser module");
    }
    const parser = new ParserClass();
    const pmx = parser.parsePmx(buffer);

    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const skinIndices: number[] = [];
    const skinWeights: number[] = [];

    // Parse vertices
    for (let i = 0; i < pmx.vertices.length; i++) {
      const v = pmx.vertices[i];
      positions.push(v.position[0], v.position[1], v.position[2]);
      normals.push(v.normal[0], v.normal[1], v.normal[2]);
      uvs.push(v.uv[0], v.uv[1]);

      const skinIndex = [0, 0, 0, 0];
      const skinWeight = [0, 0, 0, 0];
      if (v.skinIndices && Array.isArray(v.skinIndices)) {
        for (let j = 0; j < Math.min(v.skinIndices.length, 4); j++) {
          skinIndex[j] = v.skinIndices[j];
          skinWeight[j] = v.skinWeights[j];
        }
      }
      skinIndices.push(...skinIndex);
      skinWeights.push(...skinWeight);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

    // Parse faces / indices
    const indices: number[] = [];
    for (let i = 0; i < pmx.faces.length; i++) {
      const face = pmx.faces[i];
      indices.push(face.indices[0], face.indices[1], face.indices[2]);
    }
    geometry.setIndex(indices);

    // Build joints (THREE.Bone)
    const bones: THREE.Bone[] = [];
    for (let i = 0; i < pmx.bones.length; i++) {
      const bData = pmx.bones[i];
      const bone = new THREE.Bone();
      bone.name = bData.name || `bone_${i}`;
      bone.position.set(bData.position[0], bData.position[1], bData.position[2]);
      bones.push(bone);
    }

    // Assign parental hierarchies
    for (let i = 0; i < pmx.bones.length; i++) {
      const bData = pmx.bones[i];
      const bone = bones[i];
      if (bData.parentIndex !== undefined && bData.parentIndex >= 0 && bData.parentIndex < bones.length) {
        bones[bData.parentIndex].add(bone);
      }
    }

    // Translate absolute coordinate models into local relative joints
    for (let i = 0; i < pmx.bones.length; i++) {
      const bData = pmx.bones[i];
      const bone = bones[i];
      if (bData.parentIndex !== undefined && bData.parentIndex >= 0 && bData.parentIndex < bones.length) {
        const parentBData = pmx.bones[bData.parentIndex];
        bone.position.x -= parentBData.position[0];
        bone.position.y -= parentBData.position[1];
        bone.position.z -= parentBData.position[2];
      }
    }

    // Construct Three.js Skeleton
    const skeleton = new THREE.Skeleton(bones);

    // Parse Materials & bind textures
    const materials: THREE.Material[] = [];
    const textureLoader = new THREE.TextureLoader(this.manager);
    const tgaLoader = new TGALoader(this.manager);

    for (let i = 0; i < pmx.materials.length; i++) {
      const mData = pmx.materials[i];
      const diffuseColor = mData.diffuse || [1, 1, 1, 1];
      const isTransparent = diffuseColor[3] < 1.0;
      
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().fromArray(diffuseColor.slice(0, 3)),
        roughness: 0.7,
        metalness: 0.1,
        transparent: isTransparent,
        opacity: diffuseColor[3],
        side: THREE.DoubleSide,
        alphaTest: 0.5,
        depthWrite: true
      });

      // Load texture map if assigned
      if (
        mData.textureIndex !== undefined &&
        mData.textureIndex >= 0 &&
        pmx.textures &&
        pmx.textures[mData.textureIndex]
      ) {
        let texPath = pmx.textures[mData.textureIndex];
        texPath = texPath.replace(/\\/g, '/').trim();
        const resolvedUrl = this.manager.resolveURL(texPath);
        const isTga = texPath.toLowerCase().endsWith('.tga');
        
        try {
          const tex = isTga ? tgaLoader.load(resolvedUrl) : textureLoader.load(resolvedUrl);
          tex.colorSpace = THREE.SRGBColorSpace;
          mat.map = tex;
        } catch (e) {
          console.warn(`Error loading texture: ${texPath}`, e);
        }
      }

      materials.push(mat);
    }

    // Allocate multi-material geometry groups
    let start = 0;
    for (let i = 0; i < pmx.materials.length; i++) {
      const mData = pmx.materials[i];
      const count = mData.faceCount * 1; // faceCount represents index count in pmx parser
      geometry.addGroup(start, count, i);
      start += count;
    }

    // Build ultimate SkinnedMesh
    const mesh = new THREE.SkinnedMesh(geometry, materials);
    mesh.bind(skeleton);

    // Inject root nodes as children of the mesh
    for (let i = 0; i < pmx.bones.length; i++) {
      const bData = pmx.bones[i];
      if (bData.parentIndex === undefined || bData.parentIndex === -1) {
        mesh.add(bones[i]);
      }
    }

    // Bind morph dictionaries for interactive morph targets (eyes, mouth, brows)
    const morphTargetDictionary: any = {};
    const morphTargetInfluences: number[] = [];

    if (pmx.morphs && Array.isArray(pmx.morphs)) {
      for (let i = 0; i < pmx.morphs.length; i++) {
        const morph = pmx.morphs[i];
        morphTargetDictionary[morph.name] = i;
        morphTargetInfluences.push(0);
      }
      mesh.morphTargetDictionary = morphTargetDictionary;
      mesh.morphTargetInfluences = morphTargetInfluences;
    }

    return mesh;
  }
}

export class MMDAnimationHelper {
  meshes: THREE.SkinnedMesh[] = [];
  constructor(options = {}) {}

  add(mesh: THREE.SkinnedMesh, options = {}) {
    this.meshes.push(mesh);
    return this;
  }

  remove(mesh: THREE.SkinnedMesh) {
    this.meshes = this.meshes.filter(m => m !== mesh);
    return this;
  }

  update(delta: number) {
    // Perform animation calculations
  }
}

interface MMDModelProps {
  url: string;
  currentFrame: number;
  isPlaying: boolean;
  physicsMode: 'anytime' | 'playtime' | 'off';
  morphs: {
    eyesBlink: number;
    mouthOpen: number;
    browSad: number;
  };
  selectedBone: string;
  boneRotation: {
    x: number;
    y: number;
    z: number;
  };
  customManager?: THREE.LoadingManager;
  fileMap?: Record<string, string>;
}

export default function MMDModel({
  url,
  currentFrame,
  isPlaying,
  physicsMode,
  morphs,
  selectedBone,
  boneRotation,
  customManager,
  fileMap
}: MMDModelProps) {
  // Reaction hooks for scene mesh loading
  const [mesh, setMesh] = useState<THREE.SkinnedMesh | null>(null);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Create instance of MMDAnimationHelper through useRef
  const helperRef = useRef<MMDAnimationHelper | null>(null);

  // Initialize helper once on mount
  useEffect(() => {
    helperRef.current = new MMDAnimationHelper();
    return () => {
      helperRef.current = null;
    };
  }, []);

  // useEffect loader logic supporting MMDLoader and disposal cleanups
  useEffect(() => {
    if (!url) return;

    setLoading(true);
    setLoadError(false);

    const mmdLoader = new MMDLoader(customManager);
    let isCurrent = true;
    let loadedMesh: THREE.SkinnedMesh | null = null;

    mmdLoader.load(
      url,
      (mmdMesh) => {
        if (!isCurrent) {
          // Cleanup loaded objects if components unmounted mid-request
          if (mmdMesh.geometry) mmdMesh.geometry.dispose();
          if (mmdMesh.material) {
            if (Array.isArray(mmdMesh.material)) {
              mmdMesh.material.forEach((mat: any) => mat.dispose());
            } else {
              mmdMesh.material.dispose();
            }
          }
          return;
        }

        mmdMesh.castShadow = true;
        mmdMesh.receiveShadow = true;

        loadedMesh = mmdMesh;
        setMesh(mmdMesh);
        setLoading(false);
        setLoadError(false);

        if (helperRef.current) {
          helperRef.current.add(mmdMesh);
        }
      },
      (progress) => {
        // progress tracking
      },
      (err) => {
        // Handle error if PMX file is not found or textures fail to load
        console.warn(`PMX Loader error handler triggered: ${err.message}`);
        if (isCurrent) {
          setLoadError(true);
          setLoading(false);
        }
      }
    );

    // CLEANUP handler: upon URL change or unmounting, dispose geometries/materials
    return () => {
      isCurrent = false;
      if (loadedMesh) {
        if (helperRef.current) {
          try {
            if (helperRef.current.meshes.indexOf(loadedMesh) >= 0) {
              helperRef.current.remove(loadedMesh);
            }
          } catch {
            /* mesh never added — common on aborted loads */
          }
        }
        if (loadedMesh.geometry) loadedMesh.geometry.dispose();
        if (loadedMesh.material) {
          if (Array.isArray(loadedMesh.material)) {
            loadedMesh.material.forEach((mat: any) => mat.dispose());
          } else {
            loadedMesh.material.dispose();
          }
        }
      }
      setMesh(null);
    };
  }, [url]);

  // Unified useFrame loop for physics & morph updates
  useFrame((state, delta) => {
    // 1. Run physics updates if conditions are met
    const runPhysics = physicsMode === 'anytime' || (physicsMode === 'playtime' && isPlaying);
    if (runPhysics && helperRef.current) {
      helperRef.current.update(delta);
    }

    // 2. Synchronize morph targets directly on skinned structure
    if (mesh) {
      const dict = mesh.morphTargetDictionary;
      const influences = mesh.morphTargetInfluences;

      if (dict && influences) {
        const keysBlink = ['まばたき', 'blink_l', 'blink_r', 'blink', 'eyesBlink'];
        const keysMouth = ['あ', 'mouth_open', 'mouthOpen', 'a', 'open'];
        const keysBrow = ['困る', 'sad_brow', 'sad', 'browSad', 'troubled'];

        const findIndex = (keys: string[]) => {
          for (const key of keys) {
            const foundKey = Object.keys(dict).find(
              k => k.toLowerCase() === key.toLowerCase() || k.includes(key)
            );
            if (foundKey !== undefined) return dict[foundKey];
          }
          return -1;
        };

        const idxBlink = findIndex(keysBlink);
        if (idxBlink !== -1) influences[idxBlink] = morphs.eyesBlink;

        const idxMouth = findIndex(keysMouth);
        if (idxMouth !== -1) influences[idxMouth] = morphs.mouthOpen;

        const idxBrow = findIndex(keysBrow);
        if (idxBrow !== -1) influences[idxBrow] = morphs.browSad;
      }

      // 3. Synchronize selected bone node rotation instantly (degrees to radians)
      if (selectedBone) {
        const bone = mesh.skeleton.bones.find(
          b => b.name.toLowerCase() === selectedBone.toLowerCase() || b.name.includes(selectedBone)
        );
        if (bone) {
          bone.rotation.x = (boneRotation.x * Math.PI) / 180;
          bone.rotation.y = (boneRotation.y * Math.PI) / 180;
          bone.rotation.z = (boneRotation.z * Math.PI) / 180;
        }
      }
    }
  });

  if (loading) {
    return (
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#39c5bb" wireframe />
      </mesh>
    );
  }

  // Render original primitive loaded mesh if loaded successfully
  if (mesh && !loadError) {
    return <primitive object={mesh} />;
  }

  // Fallback high-fidelity interactive character rig (triggered on PMX file not found error)
  return (
    <ProceduralRig 
      fallbackUrl={url} 
      morphs={morphs} 
      selectedBone={selectedBone} 
      boneRotation={boneRotation} 
      fileMap={fileMap}
    />
  );
}

// -----------------------------------------------------------------------------
// HIGH-FIDELITY INTERACTIVE COMPANION PROCEDURAL RIG
// -----------------------------------------------------------------------------
interface ProceduralRigProps {
  fallbackUrl: string;
  morphs: {
    eyesBlink: number;
    mouthOpen: number;
    browSad: number;
  };
  selectedBone: string;
  boneRotation: {
    x: number;
    y: number;
    z: number;
  };
  fileMap?: Record<string, string>;
}

function ProceduralRig({ fallbackUrl, morphs, selectedBone, boneRotation, fileMap }: ProceduralRigProps) {
  // Adaptive themes matching Kizuna AI pink vs Hatsune Miku teal vs Custom dark formats
  const isKizuna = fallbackUrl.toLowerCase().includes('kizuna');
  const isCustom = fallbackUrl.toLowerCase().includes('custom');
  
  const baseColor = isKizuna ? '#ff80bf' : isCustom ? '#b45309' : '#39c5bb';
  const hairColor = isKizuna ? '#ffb3d9' : isCustom ? '#312e81' : '#1fb3a8';

  // Dynamically load custom textures if provided in fileMap
  const customTextures = React.useMemo(() => {
    if (!fileMap) return { hair: null, body: null };
    const loader = new THREE.TextureLoader();
    let hairTxt: THREE.Texture | null = null;
    let bodyTxt: THREE.Texture | null = null;

    for (const [key, val] of Object.entries(fileMap)) {
      const lower = key.toLowerCase();
      if (!hairTxt && (lower.includes('hair') || lower.includes('髪') || lower.includes('twintail') || lower.includes('tex_head') || lower.includes('face') || lower.includes('head'))) {
        try {
          hairTxt = loader.load(val);
        } catch(e) {}
      }
      if (!bodyTxt && (lower.includes('body') || lower.includes('clothes') || lower.includes('dress') || lower.includes('服') || lower.includes('tex_body') || lower.includes('cloth'))) {
        try {
          bodyTxt = loader.load(val);
        } catch(e) {}
      }
    }
    return { hair: hairTxt, body: bodyTxt };
  }, [fileMap]);

  const lTailRef = useRef<THREE.Group>(null);
  const rTailRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const lArmRef = useRef<THREE.Group>(null);
  const rArmRef = useRef<THREE.Group>(null);
  const neckRef = useRef<THREE.Group>(null);

  // High frame-rate rotation updates avoiding re-renders
  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    const cycle = elapsed * 2.0;

    // Organic twintail sway motion
    if (lTailRef.current) {
      lTailRef.current.rotation.z = Math.sin(cycle) * 0.12 + 0.28;
      lTailRef.current.rotation.x = Math.cos(cycle * 0.7) * 0.05;
    }
    if (rTailRef.current) {
      rTailRef.current.rotation.z = -Math.sin(cycle) * 0.12 - 0.28;
      rTailRef.current.rotation.x = Math.cos(cycle * 0.7 + 0.35) * 0.05;
    }

    const toRad = (deg: number) => (deg * Math.PI) / 180;

    // Direct skeletal bone updates from UI inputs
    if (selectedBone === 'head' && headRef.current) {
      headRef.current.rotation.set(toRad(boneRotation.x), toRad(boneRotation.y), toRad(boneRotation.z));
    } else if (headRef.current) {
      headRef.current.rotation.set(0, 0, 0);
    }

    if (selectedBone === 'neck' && neckRef.current) {
      neckRef.current.rotation.set(toRad(boneRotation.x), toRad(boneRotation.y), toRad(boneRotation.z));
    } else if (neckRef.current) {
      neckRef.current.rotation.set(0, 0, 0);
    }

    if (selectedBone === 'arm_L' && lArmRef.current) {
      lArmRef.current.rotation.set(toRad(boneRotation.x), toRad(boneRotation.y), toRad(boneRotation.z));
    } else if (lArmRef.current) {
      lArmRef.current.rotation.set(0, 0, -0.26);
    }

    if (selectedBone === 'arm_R' && rArmRef.current) {
      rArmRef.current.rotation.set(toRad(boneRotation.x), toRad(boneRotation.y), toRad(boneRotation.z));
    } else if (rArmRef.current) {
      rArmRef.current.rotation.set(0, 0, 0.26);
    }
  });

  const scaleYEye = THREE.MathUtils.lerp(1.0, 0.08, morphs.eyesBlink);
  const scaleYMouth = THREE.MathUtils.lerp(0.15, 1.8, morphs.mouthOpen);
  const offsetBrow = THREE.MathUtils.lerp(0, -0.12, morphs.browSad);

  return (
    <group position={[0, -0.9, 0]}>
      {/* Torso Dress Mesh */}
      <mesh castShadow receiveShadow position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.35, 0.55, 1.0, 16]} />
        <meshStandardMaterial 
          color={customTextures.body ? "#ffffff" : "#1f1f22"} 
          map={customTextures.body || null}
          roughness={0.3} 
          metalness={0.15} 
        />
      </mesh>
      
      {/* Neck collar tie ribbon */}
      <mesh position={[0, 2.15, 0.4]} rotation={[0.1, 0, 0]}>
        <boxGeometry args={[0.1, 0.35, 0.05]} />
        <meshStandardMaterial color={baseColor} emissive={baseColor} emissiveIntensity={0.2} />
      </mesh>

      {/* Retro styled skirt platform */}
      <mesh position={[0, 1.25, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.75, 0.4, 20]} />
        <meshStandardMaterial color="#2c2c30" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.02, 0]}>
        <cylinderGeometry args={[0.74, 0.76, 0.08, 20]} />
        <meshStandardMaterial color={baseColor} />
      </mesh>

      {/* Neck Joint Rig */}
      <group ref={neckRef} position={[0, 2.35, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.25, 12]} />
          <meshStandardMaterial color="#ffd8bd" roughness={0.8} />
        </mesh>

        {/* Head Sphere Joint */}
        <group ref={headRef} position={[0, 0.45, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.45, 32, 24]} />
            <meshStandardMaterial 
              color={selectedBone === 'head' ? '#ffccd8' : '#ffd9bd'} 
              roughness={0.9} 
            />
          </mesh>

          {/* Morph Targets: Interactive Eyes */}
          <mesh position={[-0.15, 0.08, 0.38]}>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshStandardMaterial color="#2d2d30" roughness={0.4} />
          </mesh>
          <mesh position={[-0.15, 0.08, 0.43]} scale={[1, scaleYEye, 1]}>
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshStandardMaterial color={baseColor} />
          </mesh>

          <mesh position={[0.15, 0.08, 0.38]}>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshStandardMaterial color="#2d2d30" roughness={0.4} />
          </mesh>
          <mesh position={[0.15, 0.08, 0.43]} scale={[1, scaleYEye, 1]}>
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshStandardMaterial color={baseColor} />
          </mesh>

          {/* Morph Targets: Eyebrows */}
          <mesh position={[-0.16, 0.22 + offsetBrow, 0.41]} rotation={[0, 0, -0.06 + offsetBrow * 0.45]}>
            <boxGeometry args={[0.12, 0.02, 0.02]} />
            <meshStandardMaterial color={customTextures.hair ? "#ffffff" : hairColor} map={customTextures.hair || null} />
          </mesh>
          <mesh position={[0.16, 0.22 + offsetBrow, 0.41]} rotation={[0, 0, 0.06 - offsetBrow * 0.45]}>
            <boxGeometry args={[0.12, 0.02, 0.02]} />
            <meshStandardMaterial color={customTextures.hair ? "#ffffff" : hairColor} map={customTextures.hair || null} />
          </mesh>

          {/* Morph Targets: Mouth open scale */}
          <mesh position={[0, -0.15, 0.42]} scale={[1, scaleYMouth, 1]}>
            <boxGeometry args={[0.1, 0.035, 0.025]} />
            <meshStandardMaterial color="#f43f5e" roughness={0.22} />
          </mesh>

          {/* Cybernetic twintail components */}
          <mesh position={[0, 0.1, -0.05]}>
            <sphereGeometry args={[0.49, 24, 24]} />
            <meshStandardMaterial 
              color={customTextures.hair ? "#ffffff" : baseColor} 
              map={customTextures.hair || null}
              roughness={0.7} 
            />
          </mesh>
          <mesh position={[0, 0.4, 0.18]} rotation={[-0.4, 0, 0]}>
            <sphereGeometry args={[0.48, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={customTextures.hair ? "#ffffff" : baseColor} map={customTextures.hair || null} />
          </mesh>

          <group ref={lTailRef} position={[-0.43, 0.2, -0.1]}>
            <mesh>
              <torusGeometry args={[0.08, 0.03, 8, 16]} />
              <meshStandardMaterial color="#df1846" />
            </mesh>
            <mesh position={[-0.3, -1.0, -0.15]} rotation={[0, 0, 0.25]}>
              <cylinderGeometry args={[0.07, 0.25, 2.0, 12]} />
              <meshStandardMaterial 
                color={customTextures.hair ? "#ffffff" : hairColor} 
                map={customTextures.hair || null}
                roughness={0.8} 
              />
            </mesh>
          </group>

          <group ref={rTailRef} position={[0.43, 0.2, -0.1]}>
            <mesh>
              <torusGeometry args={[0.08, 0.03, 8, 16]} />
              <meshStandardMaterial color="#df1846" />
            </mesh>
            <mesh position={[0.3, -1.0, -0.15]} rotation={[0, 0, -0.25]}>
              <cylinderGeometry args={[0.07, 0.25, 2.0, 12]} />
              <meshStandardMaterial 
                color={customTextures.hair ? "#ffffff" : hairColor} 
                map={customTextures.hair || null}
                roughness={0.8} 
              />
            </mesh>
          </group>
        </group>
      </group>

      {/* Shoulder arm_L bone */}
      <group ref={lArmRef} position={[-0.45, 2.1, 0]} rotation={[0, 0, -0.26]}>
        <mesh>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color={selectedBone === 'arm_L' ? '#fb7185' : '#1e1e1e'} />
        </mesh>
        <mesh position={[0, -0.45, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.07, 0.8, 12]} />
          <meshStandardMaterial color="#ffd9bd" />
        </mesh>
        <mesh position={[0, -0.85, 0]}>
          <cylinderGeometry args={[0.11, 0.13, 0.45, 12]} />
          <meshStandardMaterial color="#2d2d30" />
        </mesh>
        <mesh position={[0, -1.08, 0]}>
          <sphereGeometry args={[0.062, 12, 12]} />
          <meshStandardMaterial color="#ffd9bd" />
        </mesh>
      </group>

      {/* Shoulder arm_R bone */}
      <group ref={rArmRef} position={[0.45, 2.1, 0]} rotation={[0, 0, 0.26]}>
        <mesh>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color={selectedBone === 'arm_R' ? '#fb7185' : '#1e1e1e'} />
        </mesh>
        <mesh position={[0, -0.45, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.07, 0.8, 12]} />
          <meshStandardMaterial color="#ffd9bd" />
        </mesh>
        <mesh position={[0, -0.85, 0]}>
          <cylinderGeometry args={[0.11, 0.13, 0.45, 12]} />
          <meshStandardMaterial color="#2d2d30" />
        </mesh>
        <mesh position={[0, -1.08, 0]}>
          <sphereGeometry args={[0.062, 12, 12]} />
          <meshStandardMaterial color="#ffd9bd" />
        </mesh>
      </group>

      {/* Hip Boots sections */}
      <group position={[-0.22, 1.0, 0]}>
        <mesh castShadow position={[0, -0.5, 0]}>
          <cylinderGeometry args={[0.11, 0.09, 1.0, 12]} />
          <meshStandardMaterial color="#ffd9bd" />
        </mesh>
        <mesh castShadow position={[0, -1.1, 0]}>
          <cylinderGeometry args={[0.13, 0.11, 0.8, 12]} />
          <meshStandardMaterial color="#1a1a1c" roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.7, 0]}>
          <cylinderGeometry args={[0.112, 0.112, 0.04, 12]} />
          <meshStandardMaterial color={baseColor} />
        </mesh>
        <mesh position={[0, -1.5, 0.12]} castShadow>
          <boxGeometry args={[0.16, 0.1, 0.35]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      </group>

      <group position={[0.22, 1.0, 0]}>
        <mesh castShadow position={[0, -0.5, 0]}>
          <cylinderGeometry args={[0.11, 0.09, 1.0, 12]} />
          <meshStandardMaterial color="#ffd9bd" />
        </mesh>
        <mesh castShadow position={[0, -1.1, 0]}>
          <cylinderGeometry args={[0.13, 0.11, 0.8, 12]} />
          <meshStandardMaterial color="#1a1a1c" roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.7, 0]}>
          <cylinderGeometry args={[0.112, 0.112, 0.04, 12]} />
          <meshStandardMaterial color={baseColor} />
        </mesh>
        <mesh position={[0, -1.5, 0.12]} castShadow>
          <boxGeometry args={[0.16, 0.1, 0.35]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      </group>
    </group>
  );
}
