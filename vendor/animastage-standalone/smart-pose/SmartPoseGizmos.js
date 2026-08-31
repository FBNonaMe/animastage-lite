import * as THREE from "three";
import { SMART_POSE_CONTROLLER_DEFS, controllerDefById } from "./SmartPosePresets.js";

const HOVER_COLOR = 0xfff0a3;
const SELECTED_COLOR = 0xffffff;
const INVALID_COLOR = 0xff3b3b;

function makeMaterial(color, opacity = 0.88) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
  });
}

export class SmartPoseGizmos {
  constructor({ getScene, getCamera, getRenderer }) {
    this.getScene = getScene;
    this.getCamera = getCamera;
    this.getRenderer = getRenderer;
    this.root = new THREE.Group();
    this.root.name = "SmartPoseGizmos";
    this.root.visible = false;
    this.root.renderOrder = 60;
    this.controllers = new Map();
    this.pickables = [];
    this.selectedId = null;
    this.hoverId = null;
    this.invalidIds = new Set();
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.tmp = new THREE.Vector3();
    this.assets = this.createAssets();
    this.getScene()?.add(this.root);
  }

  createAssets() {
    return {
      ringGeo: new THREE.TorusGeometry(1, 0.045, 10, 48),
      sphereGeo: new THREE.SphereGeometry(0.72, 20, 14),
      handGeo: new THREE.TorusGeometry(0.82, 0.08, 10, 36),
      footGeo: new THREE.BoxGeometry(1.45, 0.18, 0.78),
      poleGeo: new THREE.OctahedronGeometry(0.72, 0),
      pickGeo: new THREE.SphereGeometry(1.2, 12, 8),
      crossGeo: new THREE.SphereGeometry(0.42, 14, 10),
      pickMat: new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.001,
        depthTest: false,
        depthWrite: false,
      }),
    };
  }

  rebuildControllers(defs = SMART_POSE_CONTROLLER_DEFS) {
    this.disposeControllers();
    for (const def of defs) this.createController(def);
  }

  createController(def) {
    const target = new THREE.Group();
    target.name = `SmartPose:${def.id}`;
    target.userData.smartPoseControllerId = def.id;
    target.userData.isSmartPoseController = true;
    target.renderOrder = 61;

    const mat = makeMaterial(def.color);
    const meshes = [];
    const addMesh = (geo, scale = [1, 1, 1], rot = null) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.set(scale[0], scale[1], scale[2]);
      if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
      mesh.renderOrder = 62;
      mesh.userData.smartPoseControllerId = def.id;
      mesh.userData.isSmartPoseController = true;
      target.add(mesh);
      meshes.push(mesh);
      return mesh;
    };

    if (def.shape === "foot") {
      addMesh(this.assets.footGeo, [1, 1, 1]);
    } else if (def.shape === "pole") {
      addMesh(this.assets.poleGeo, [0.65, 0.65, 0.65]);
    } else if (def.shape === "sphere") {
      addMesh(this.assets.sphereGeo, [0.65, 0.65, 0.65]);
      addMesh(this.assets.ringGeo, [0.82, 0.82, 0.82], [Math.PI / 2, 0, 0]);
    } else if (def.shape === "hand") {
      addMesh(this.assets.handGeo, [0.8, 0.8, 0.8], [Math.PI / 2, 0, 0]);
      addMesh(this.assets.sphereGeo, [0.18, 0.18, 0.18]);
    } else if (def.shape === "look") {
      addMesh(this.assets.crossGeo, [0.55, 0.55, 0.55]);
      addMesh(this.assets.ringGeo, [0.62, 0.62, 0.62], [Math.PI / 2, 0, 0]);
    } else {
      addMesh(this.assets.ringGeo, [0.85, 0.85, 0.85], [Math.PI / 2, 0, 0]);
      addMesh(this.assets.ringGeo, [0.85, 0.85, 0.85], [0, Math.PI / 2, 0]);
    }

    const pick = new THREE.Mesh(this.assets.pickGeo, this.assets.pickMat);
    pick.name = `SmartPosePick:${def.id}`;
    pick.userData.smartPoseControllerId = def.id;
    pick.userData.isSmartPoseController = true;
    pick.renderOrder = 63;
    target.add(pick);

    this.root.add(target);
    this.controllers.set(def.id, { def, target, mat, meshes, pick });
    this.pickables.push(pick, ...meshes);
    return target;
  }

  disposeControllers() {
    for (const entry of this.controllers.values()) {
      this.root.remove(entry.target);
      if (entry.mat?.dispose) entry.mat.dispose();
    }
    this.controllers.clear();
    this.pickables.length = 0;
    this.selectedId = null;
    this.hoverId = null;
    this.invalidIds.clear();
  }

  setVisible(visible) {
    this.root.visible = !!visible;
  }

  objectFor(id) {
    return this.controllers.get(id)?.target || null;
  }

  controllerObjects() {
    const out = new Map();
    for (const [id, entry] of this.controllers) out.set(id, entry.target);
    return out;
  }

  isControllerObject(obj) {
    if (!obj) return false;
    let cur = obj;
    while (cur) {
      if (cur.userData?.isSmartPoseController) return true;
      cur = cur.parent;
    }
    return false;
  }

  controllerIdFromObject(obj) {
    let cur = obj;
    while (cur) {
      if (cur.userData?.smartPoseControllerId) return cur.userData.smartPoseControllerId;
      cur = cur.parent;
    }
    return null;
  }

  setSelected(id) {
    this.selectedId = id || null;
    this.refreshMaterials();
  }

  setHover(id) {
    if (this.hoverId === id) return;
    this.hoverId = id || null;
    this.refreshMaterials();
  }

  setInvalidControllers(ids = []) {
    this.invalidIds = new Set(ids || []);
    this.refreshMaterials();
  }

  refreshMaterials() {
    for (const [id, entry] of this.controllers) {
      if (this.invalidIds.has(id)) {
        entry.mat.color.setHex(INVALID_COLOR);
        entry.mat.opacity = id === this.selectedId || id === this.hoverId ? 0.98 : 0.9;
      } else if (id === this.selectedId) {
        entry.mat.color.setHex(SELECTED_COLOR);
        entry.mat.opacity = 0.98;
      } else if (id === this.hoverId) {
        entry.mat.color.setHex(HOVER_COLOR);
        entry.mat.opacity = 0.95;
      } else {
        const def = controllerDefById(id) || entry.def;
        entry.mat.color.setHex(def?.color ?? 0xffffff);
        entry.mat.opacity = 0.88;
      }
    }
  }

  setControllerTransform(id, position, quaternion = null) {
    const obj = this.objectFor(id);
    if (!obj || !position) return;
    obj.position.copy(position);
    if (quaternion) obj.quaternion.copy(quaternion);
    obj.updateMatrixWorld(true);
  }

  updateScale() {
    if (!this.root.visible) return;
    const camera = this.getCamera?.();
    if (!camera) return;
    for (const entry of this.controllers.values()) {
      entry.target.getWorldPosition(this.tmp);
      const dist = Math.max(0.1, camera.position.distanceTo(this.tmp));
      const scale = Math.max(0.08, Math.min(0.85, dist * 0.025));
      entry.target.scale.setScalar(scale);
    }
  }

  pickFromEvent(e) {
    if (!this.root.visible || !this.pickables.length) return null;
    const renderer = this.getRenderer?.();
    const camera = this.getCamera?.();
    if (!renderer?.domElement || !camera) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    this.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    if (!hits.length) return null;
    return this.controllerIdFromObject(hits[0].object);
  }

  dispose() {
    this.disposeControllers();
    this.getScene()?.remove(this.root);
    for (const key of ["ringGeo", "sphereGeo", "handGeo", "footGeo", "poleGeo", "pickGeo", "crossGeo"]) {
      this.assets[key]?.dispose?.();
    }
    this.assets.pickMat?.dispose?.();
  }
}
