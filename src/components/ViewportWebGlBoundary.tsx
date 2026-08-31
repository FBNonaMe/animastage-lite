import { Component, type ErrorInfo, type ReactNode } from 'react';
import { markWebGlContextCreationFailed } from '../render/graphicsSystemStore';

interface Props {
  children: ReactNode;
  /** Bump on graphics remount so a recovered canvas can mount again. */
  resetKey: number;
}

interface State {
  error: Error | null;
}

function isRecoverableWebGlError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return (
    /alpha/i.test(msg) ||
    /webgl/i.test(msg) ||
    /context/i.test(msg) ||
    /getContextAttributes/i.test(msg)
  );
}

/**
 * Catches R3F Canvas rethrows (postprocessing `.alpha` on lost context) so the
 * whole studio does not white-screen. Triggers graphics recovery instead.
 */
export default class ViewportWebGlBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('[WebGL] Viewport canvas error (recovering):', error.message, info.componentStack);
    if (isRecoverableWebGlError(error)) {
      markWebGlContextCreationFailed();
    }
  }

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      if (!isRecoverableWebGlError(this.state.error)) {
        throw this.state.error;
      }
      return (
        <div className="w-full h-full flex items-center justify-center bg-[#0d0e11] text-center px-6">
          <div className="max-w-sm">
            <p className="text-sm font-semibold text-zinc-200">Recovering graphics…</p>
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
              The 3D viewport hit a GPU reset. Restarting the renderer…
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
