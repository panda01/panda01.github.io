import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';

/** Props for the last-resort error boundary around the whole desktop. */
export interface RootErrorBoundaryProps {
  /** Deletes the visitor's saved desktop and reloads, for when saved data keeps causing crashes. */
  onResetDesktop: () => void;
  /** Reloads the page. */
  onReload: () => void;
  children: ReactNode;
}

interface RootErrorBoundaryState {
  caughtError: Error | undefined;
}

/**
 * Catches a crash anywhere in the desktop and offers to reload or, if the visitor's saved data is
 * the cause, to reset the desktop.
 */
export class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  override state: RootErrorBoundaryState = { caughtError: undefined };

  /**
   * Records the crash so the next render shows the recovery screen.
   * @param caughtError - The error thrown while rendering.
   * @returns The new boundary state.
   */
  static getDerivedStateFromError(caughtError: Error): RootErrorBoundaryState {
    return { caughtError };
  }

  /**
   * Logs the crash for debugging.
   * @param caughtError - The error thrown.
   * @param errorInfo - React's component stack.
   */
  override componentDidCatch(caughtError: Error, errorInfo: ErrorInfo): void {
    console.error('The desktop crashed.', caughtError, errorInfo.componentStack);
  }

  /**
   * Shows the desktop, or the recovery screen after a crash.
   * @returns The rendered content.
   */
  override render(): ReactNode {
    if (this.state.caughtError === undefined) {
      return this.props.children;
    }
    return (
      <Box
        component="main"
        sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}
      >
        <Stack role="alert" spacing={2} sx={{ maxWidth: 420, textAlign: 'center' }}>
          <Typography component="h1" variant="h6">
            Something went wrong
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {this.state.caughtError.message}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'center' }}>
            <Button variant="contained" onClick={this.props.onReload}>
              Reload
            </Button>
            <Button color="error" onClick={this.props.onResetDesktop}>
              Reset Desktop
            </Button>
          </Stack>
        </Stack>
      </Box>
    );
  }
}
