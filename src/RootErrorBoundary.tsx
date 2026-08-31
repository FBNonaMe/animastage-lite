import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

export default class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[AnimaStage] Root render error:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  private handleCopy = () => {
    const { error, componentStack } = this.state;
    const text = [error?.message, error?.stack, componentStack].filter(Boolean).join('\n\n');
    void navigator.clipboard?.writeText(text);
  };

  render() {
    if (this.state.error) {
      const { componentStack } = this.state;
      return (
        <div className="min-h-screen bg-[#0a0b0e] text-zinc-100 flex flex-col items-center justify-center gap-4 px-6 text-center font-sans">
          <p className="text-lg font-bold text-red-300">Something went wrong loading the studio</p>
          <p className="text-sm text-zinc-500 max-w-md font-mono break-all">{this.state.error.message}</p>
          {componentStack ? (
            <details className="max-w-xl w-full text-left">
              <summary className="text-xs text-zinc-400 cursor-pointer">Technical details</summary>
              <pre className="mt-2 max-h-64 overflow-auto text-[10px] leading-relaxed text-zinc-500 bg-[#12141a] border border-zinc-800 rounded-lg p-3 whitespace-pre-wrap">
                {componentStack.trim()}
              </pre>
            </details>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer"
              onClick={() => window.location.assign('./app')}
            >
              Reload studio
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 font-bold cursor-pointer"
              onClick={this.handleCopy}
            >
              Copy error
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
