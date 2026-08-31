export class SmartPoseDebug {
  constructor() {
    this.enabled = false;
    this.lastStats = null;
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
  }

  log(...args) {
    if (this.enabled) console.debug("[SmartPose]", ...args);
  }

  setStats(stats) {
    this.lastStats = stats || null;
    if (this.enabled && stats) console.debug("[SmartPose:stats]", stats);
  }
}
