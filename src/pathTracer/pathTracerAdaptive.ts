/** Adaptive quality governor for Path Tracer Lab (FPS-driven res / tris / bounces). */

export interface PathTracerLabSafeLimits {
  minResolutionScale: number;
  maxResolutionScale: number;
  minTriangles: number;
  maxTriangles: number;
  minBounces: number;
  maxBounces: number;
  targetFps: number;
  minSubmitIntervalMs: number;
}

export const PATH_TRACER_LAB_SAFE_LIMITS: PathTracerLabSafeLimits = {
  minResolutionScale: 0.12,
  maxResolutionScale: 0.38,
  minTriangles: 1500,
  maxTriangles: 12_000,
  minBounces: 1,
  maxBounces: 5,
  targetFps: 22,
  minSubmitIntervalMs: 28,
};

export interface PathTracerAdaptiveTick {
  resolutionScale: number;
  maxBounces: number;
  samplesPerFrame: number;
  enableDenoise: boolean;
  denoiseMaxRadius: number;
  maxTriangles: number;
}

export class PathTracerQualityGovernor {
  resolutionScale: number;
  maxTriangles: number;
  fps = 30;

  private readonly limits: PathTracerLabSafeLimits;
  private fpsSmooth = 30;
  private lastSubmitMs = 0;

  constructor(
    initialScale: number,
    initialTriangles: number,
    limits: PathTracerLabSafeLimits = PATH_TRACER_LAB_SAFE_LIMITS
  ) {
    this.resolutionScale = initialScale;
    this.maxTriangles = initialTriangles;
    this.limits = limits;
  }

  reset(scale: number, triangles: number): void {
    this.resolutionScale = scale;
    this.maxTriangles = triangles;
    this.fpsSmooth = 30;
    this.fps = 30;
    this.lastSubmitMs = 0;
  }

  canSubmit(nowMs: number): boolean {
    return nowMs - this.lastSubmitMs >= this.limits.minSubmitIntervalMs;
  }

  recordSubmit(nowMs: number): void {
    this.lastSubmitMs = nowMs;
  }

  tick(frameMs: number, cameraStill: boolean, userBounces: number): PathTracerAdaptiveTick {
    const instantFps = 1000 / Math.max(frameMs, 1);
    this.fpsSmooth = this.fpsSmooth * 0.85 + instantFps * 0.15;
    this.fps = this.fpsSmooth;

    if (this.fpsSmooth < this.limits.targetFps - 4) {
      this.resolutionScale = Math.max(
        this.limits.minResolutionScale,
        this.resolutionScale * 0.92
      );
      this.maxTriangles = Math.max(
        this.limits.minTriangles,
        Math.floor(this.maxTriangles * 0.95)
      );
    } else if (this.fpsSmooth > this.limits.targetFps + 6 && cameraStill) {
      this.resolutionScale = Math.min(
        this.limits.maxResolutionScale,
        this.resolutionScale * 1.04
      );
      this.maxTriangles = Math.min(
        this.limits.maxTriangles,
        Math.floor(this.maxTriangles * 1.03)
      );
    }

    const maxBounces = Math.min(
      this.limits.maxBounces,
      Math.max(
        this.limits.minBounces,
        cameraStill ? userBounces : Math.min(userBounces, 2)
      )
    );

    return {
      resolutionScale: this.resolutionScale,
      maxBounces,
      samplesPerFrame: this.fpsSmooth >= this.limits.targetFps ? 2 : 1,
      enableDenoise: cameraStill,
      denoiseMaxRadius: cameraStill ? 2 : 1,
      maxTriangles: this.maxTriangles,
    };
  }
}
