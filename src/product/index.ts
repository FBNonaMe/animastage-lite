/**
 * Product Layer — wraps the engine without modifying VMD, physics, or render loop.
 */
export * from './scene';
export * from './share';
export * from './viewer';
export * from './templates';
export * from './shorts';
export * from './camera-presets';
export * from './camera';
export * from './assets';
export * from './ux';
export type { ProductShortsFlowHandle } from './ux/ProductShortsFlow';
export { navigateToEditorFork, consumeForkScene, hasForkParam } from './share/fork';
export {
  OnboardingOverlay,
  ResultFirstBar,
  shouldAutoLoadDemo,
  markResultFirstDone,
  shouldShowOnboarding,
  dismissOnboardingFlag,
} from './onboarding';
export {
  ProductFlowBar,
  PerformanceOverlay,
  TemplatePicker,
  shouldShowTimeline,
  isBeginnerMode,
  shouldShowAdvancedSidebar,
} from './ui';
export { useProductLayer } from './hooks/useProductLayer';
export * from './cinematic';
export * from './vcs';
