import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { formatFirebaseError } from '../../firebase/firebaseErrors';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const friendly = formatFirebaseError(this.state.error);

    return (
      <div className="min-h-screen bg-[#FFF8EF] text-[#1F1D2B] flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-[#DC2626]/25 bg-white p-6 sm:p-8 shadow-xl space-y-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#DC2626]/12 text-[#DC2626]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#DC2626]">
                3D Jummo Fashion World · Recovery Guard
              </p>
              <h1 className="mt-1 font-heading text-xl font-bold text-[#1F1D2B]">
                {friendly.title}
              </h1>
              <p className="mt-2 text-sm text-[#1F1D2B]/75 leading-relaxed">
                {friendly.message}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#1F1D2B]/10">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#FF7A00] px-4 text-xs font-semibold text-white hover:bg-[#e56d00] cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
            <button
              type="button"
              onClick={() => {
                window.history.pushState({}, '', '/');
                window.location.reload();
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF] px-4 text-xs font-semibold text-[#1F1D2B] hover:border-[#FF7A00] cursor-pointer"
            >
              <Home className="h-4 w-4" />
              Return to Storefront
            </button>
          </div>
        </div>
      </div>
    );
  }
}
