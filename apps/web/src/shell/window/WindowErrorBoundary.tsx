import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button, Stack, Typography } from '@mui/material';

/** Props for the per-window error boundary. */
export interface WindowErrorBoundaryProps {
  /** Name of the app shown in the window, used in the message. */
  appName: string;
  /** Closes the crashed window. */
  onCloseWindow: () => void;
  children: ReactNode;
}

interface WindowErrorBoundaryState {
  caughtError: Error | undefined;
}

/**
 * Catches a crash inside one window so it cannot take down the whole desktop, and shows a
 * macOS-style "quit unexpectedly" message with options to reopen or close.
 */
export class WindowErrorBoundary extends Component<
  WindowErrorBoundaryProps,
  WindowErrorBoundaryState
> {
  override state: WindowErrorBoundaryState = { caughtError: undefined };

  /**
   * Records the crash so the next render shows the error message.
   * @param caughtError - The error thrown while rendering the window's content.
   * @returns The new boundary state.
   */
  static getDerivedStateFromError(caughtError: Error): WindowErrorBoundaryState {
    return { caughtError };
  }

  /**
   * Logs the crash for debugging.
   * @param caughtError - The error thrown.
   * @param errorInfo - React's component stack.
   */
  override componentDidCatch(caughtError: Error, errorInfo: ErrorInfo): void {
    console.error(
      `${this.props.appName} quit unexpectedly.`,
      caughtError,
      errorInfo.componentStack,
    );
  }

  /**
   * Shows the window content, or the crash message after an error.
   * @returns The rendered content.
   */
  override render(): ReactNode {
    if (this.state.caughtError === undefined) {
      return this.props.children;
    }
    return (
      <Stack role="alert" spacing={1.5} sx={{ p: 3, alignItems: 'flex-start' }}>
        <Typography sx={{ fontWeight: 600 }}>{this.props.appName} quit unexpectedly.</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {this.state.caughtError.message}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              this.setState({ caughtError: undefined });
            }}
          >
            Reopen
          </Button>
          <Button size="small" onClick={this.props.onCloseWindow}>
            Close
          </Button>
        </Stack>
      </Stack>
    );
  }
}
