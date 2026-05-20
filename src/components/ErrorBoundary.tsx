"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean; message: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : "Error inesperado.";
    return { hasError: true, message };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
            <div>
              <p className="text-lg font-semibold text-red-400">Algo salió mal</p>
              <p className="mt-2 text-sm text-slate-400">{this.state.message}</p>
              <button
                className="mt-6 rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                onClick={() => this.setState({ hasError: false, message: "" })}
              >
                Reintentar
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
