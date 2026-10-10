import React, { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("VISIONEXIS Uncaught UI Exception caught by ErrorBoundary:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6 text-white font-sans">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-800/90 p-8 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-3 text-amber-400 mb-4">
              <div className="rounded-full bg-amber-400/10 p-2.5 ring-1 ring-amber-400/30">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Application Exception Caught</h1>
                <p className="text-xs text-slate-400">VISIONEXIS Safe Mode</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              An unexpected user-interface error occurred while rendering this view. Your session data in storage has been preserved.
            </p>

            {this.state.error?.message && (
              <div className="mt-4 rounded-lg bg-slate-950 p-3 text-[11px] font-mono text-red-300 overflow-x-auto border border-slate-800">
                {this.state.error.message}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow hover:bg-teal-500 transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reload Application
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Attempt Recovery
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
