/* ErrorBoundary.jsx — stops one crashing view from blanking the whole app.
   React unmounts the entire tree on an uncaught render error, and <Suspense>
   only catches loading — not exceptions. This class boundary catches a render
   throw, shows a recoverable message, and auto-resets when the user navigates
   to another view (resetKey change). */
import { Component } from "react";
import { C, sans } from "../lib/theme.js";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    // Surface it in the console for debugging; never re-throw.
    // eslint-disable-next-line no-console
    console.error("View crashed:", err, info?.componentStack);
  }

  componentDidUpdate(prev) {
    // Navigating away from the broken view clears the error.
    if (prev.resetKey !== this.props.resetKey && this.state.err) {
      this.setState({ err: null });
    }
  }

  render() {
    if (this.state.err) {
      return (
        <div style={{ ...sans, padding: "48px 32px", color: C.dim, fontSize: 14, maxWidth: 640 }}>
          <div style={{ color: C.text, fontSize: 19, marginBottom: 8 }}>
            Something went wrong loading this view.
          </div>
          <div style={{ lineHeight: 1.6, marginBottom: 18 }}>
            The rest of the terminal is fine — switch to another tab, or retry below.
            If it keeps happening, a refresh will clear it.
          </div>
          <button
            onClick={() => this.setState({ err: null })}
            style={{
              ...sans, fontSize: 13, padding: "8px 16px", borderRadius: 8, cursor: "pointer",
              border: `1px solid ${C.line2}`, background: C.bg800, color: C.text,
            }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
