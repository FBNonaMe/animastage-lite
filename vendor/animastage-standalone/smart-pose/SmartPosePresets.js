export const SMART_POSE_MODE = {
  CLASSIC: "classic-bones",
  SMART: "smart-pose",
};

export const SMART_POSE_CONTROLLER_DEFS = [
  { id: "root", label: "Root", side: "center", shape: "ring", color: 0xd8ccff },
  { id: "pelvis", label: "Pelvis", side: "center", shape: "ring", color: 0xf0d27a },
  { id: "chest", label: "Chest", side: "center", shape: "ring", color: 0x9fd8ff },
  { id: "head", label: "Head", side: "center", shape: "sphere", color: 0xffffff },
  { id: "leftHand", label: "Left Hand", side: "left", shape: "hand", color: 0x6fb7ff },
  { id: "rightHand", label: "Right Hand", side: "right", shape: "hand", color: 0xff8d8d },
  { id: "leftElbowPole", label: "Left Elbow Pole", side: "left", shape: "pole", color: 0x4d9fff },
  { id: "rightElbowPole", label: "Right Elbow Pole", side: "right", shape: "pole", color: 0xff6e7d },
  { id: "leftFoot", label: "Left Foot", side: "left", shape: "foot", color: 0x4dd7c8 },
  { id: "rightFoot", label: "Right Foot", side: "right", shape: "foot", color: 0xffb05a },
  { id: "leftKneePole", label: "Left Knee Pole", side: "left", shape: "pole", color: 0x35c7b7 },
  { id: "rightKneePole", label: "Right Knee Pole", side: "right", shape: "pole", color: 0xff923d },
  { id: "lookTarget", label: "Look Target", side: "center", shape: "look", color: 0xc9ff7a },
];

export const DEFAULT_SMART_POSE_SETTINGS = {
  autoKey: true,
  // Manual posing remains physics-frozen. During Play, release the skeleton
  // owner so Reze can animate hair, clothes and accessories with the keys.
  playbackPhysics: true,
  fullBodyIK: true,
  footLock: false,
  grounding: false,
  collisionAvoidance: false,
  autoShoulder: true,
  autoPelvis: true,
  ikStrength: 1,
  armIKStrength: 1,
  legIKStrength: 1,
  shoulderCompensation: 0.25,
  clavicleFollow: 0.35,
  chestFollow: 0.12,
  elbowLimit: 1,
  kneeLimit: 1,
  stretchLimit: 1,
  handRotationFollow: 1,
  footRotationFollow: 1,
  ikFkBlend: 1,
  bodyInfluence: 0.35,
  spineCompensation: 0.2,
  pelvisCompensation: 0.2,
  balanceStrength: 0.25,
  footLockStrength: 1,
  handReachCompensation: 0.2,
  bodyTwistLimit: 0.65,
  smoothing: 0,
  iterations: 1,
  debug: false,
  // leg-solver-ownership.ts: null = auto-pick per model (native MMD IK
  // preferred, then smartPoseIk, then disabled)
  legSolverMode: null,
  // look-at limits (quaternion-limits.ts)
  lookAtYawLimitDeg: 70,
  lookAtPitchLimitDeg: 45,
  lookAtWeight: 1,
};

export const JOINT_LIMIT_PRESETS = {
  "MMD Default": { elbow: 150, knee: 155, wrist: 85, shoulder: 115, hip: 105, neck: 70, spine: 55 },
  "Anime Flexible": { elbow: 168, knee: 170, wrist: 105, shoulder: 135, hip: 125, neck: 82, spine: 68 },
  "Human Natural": { elbow: 145, knee: 150, wrist: 75, shoulder: 100, hip: 95, neck: 62, spine: 48 },
  Strict: { elbow: 125, knee: 135, wrist: 55, shoulder: 82, hip: 78, neck: 45, spine: 35 },
  Custom: {},
};

export function cloneSmartPoseSettings(overrides = {}) {
  return { ...DEFAULT_SMART_POSE_SETTINGS, ...overrides };
}

export function controllerDefById(id) {
  return SMART_POSE_CONTROLLER_DEFS.find((def) => def.id === id) || null;
}

export function mirrorSmartControllerId(id) {
  if (!id) return null;
  if (id.startsWith("left")) return `right${id.slice(4)}`;
  if (id.startsWith("right")) return `left${id.slice(5)}`;
  return id;
}

export function controllerNeedsPole(id) {
  return id === "leftHand" || id === "rightHand" || id === "leftFoot" || id === "rightFoot";
}

export function preferredTransformModeForController(id) {
  if (id === "chest") return "rotate";
  if (id === "root" || id === "pelvis" || id === "head" || id === "lookTarget") return "translate";
  if (id && id.includes("Pole")) return "translate";
  return "translate";
}
