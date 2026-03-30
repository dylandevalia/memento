import { Alert, Box, Button, Typography } from "@mui/material";
import { Component, type ReactNode } from "react";
import { getErrorMessage } from "@/lib/errorHandler";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch and handle React errors gracefully
 * Displays a fallback UI when an error occurs
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(
    error: Error,
    errorInfo: { componentStack: string },
  ) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 3,
            bgcolor: "background.default",
          }}
        >
          <Box sx={{ maxWidth: 500, width: "100%" }}>
            <Alert
              severity="error"
              sx={{ mb: 3 }}
              action={
                <Button color="inherit" size="small" onClick={this.handleReset}>
                  Retry
                </Button>
              }
            >
              <Typography variant="h6" sx={{ mb: 1 }}>
                Something went wrong
              </Typography>
              <Typography variant="body2">
                {getErrorMessage(this.state.error)}
              </Typography>
            </Alert>

            <Typography variant="body2" color="text.secondary">
              If this problem persists, please try refreshing the page.
            </Typography>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}
