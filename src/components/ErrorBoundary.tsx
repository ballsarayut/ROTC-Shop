import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  errorStr: string;
  errorInfoStr: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorStr: "",
    errorInfoStr: "",
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorStr: error?.toString() || "Unknown Error", errorInfoStr: "" };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfoStr: errorInfo?.componentStack || "" });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: "red", background: "#fdd", fontFamily: "monospace", minHeight: "100vh", overflow: "auto" }}>
          <h2>Something went wrong (Oops, หน้าขาว):</h2>
          <p>This is an internal error in the app. Please take a screenshot.</p>
          <hr />
          <b>Error:</b>
          <pre style={{ whiteSpace: "pre-wrap" }}>{this.state.errorStr}</pre>
          <b>Stack:</b>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "10px" }}>{this.state.errorInfoStr}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}
