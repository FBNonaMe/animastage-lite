import { Component, type ErrorInfo, type ReactNode } from 'react';

interface SceneFxErrorBoundaryProps {
  effectId: string;
  onError: (effectId: string, message: string) => void;
  children: ReactNode;
}

interface SceneFxErrorBoundaryState {
  failed: boolean;
}

/** Isolates a single Scene FX layer so one failure does not break the whole stack. */
export default class SceneFxErrorBoundary extends Component<
  SceneFxErrorBoundaryProps,
  SceneFxErrorBoundaryState
> {
  state: SceneFxErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): SceneFxErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    this.props.onError(this.props.effectId, error.message || 'Effect runtime error');
  }

  render(): ReactNode {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
