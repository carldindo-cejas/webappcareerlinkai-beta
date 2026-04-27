import { Component, ErrorInfo, ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <h1 className="font-display text-2xl text-forest-700 mb-3">
            Something went wrong.
          </h1>
          <p className="text-forest-700/70 mb-6">
            The page hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            onClick={this.handleReload}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-forest-700 text-cream-50 font-medium hover:bg-forest-900 transition-colors"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
