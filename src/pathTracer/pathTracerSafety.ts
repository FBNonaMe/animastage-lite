export { PATH_TRACER_LAB_SAFE_LIMITS } from './pathTracerAdaptive';

/** Wait until PMX import / physics warmup finishes before first GPU bake. */
export function isPathTracerSettled(nowMs: number, modelSettleUntilMs: number): boolean {
  return modelSettleUntilMs <= 0 || nowMs >= modelSettleUntilMs;
}
