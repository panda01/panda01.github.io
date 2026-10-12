import { useId } from 'react';
import type { JSX } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

/** Props for the reset confirmation. */
export interface ResetDesktopDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirmReset: () => void;
}

/**
 * Asks the visitor to confirm resetting the desktop, which deletes everything they changed.
 * @param props - Whether the dialog is open and its two outcomes.
 * @param props.isOpen - Whether to show the dialog.
 * @param props.onCancel - Closes the dialog without resetting.
 * @param props.onConfirmReset - Resets the desktop.
 * @returns The dialog.
 */
export function ResetDesktopDialog({
  isOpen,
  onCancel,
  onConfirmReset,
}: ResetDesktopDialogProps): JSX.Element {
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  return (
    <Dialog
      open={isOpen}
      onClose={onCancel}
      aria-labelledby={dialogTitleId}
      aria-describedby={dialogDescriptionId}
    >
      <DialogTitle id={dialogTitleId}>Reset Desktop?</DialogTitle>
      <DialogContent>
        <DialogContentText id={dialogDescriptionId}>
          Every file, folder and window you changed will be deleted, and the desktop will go back to
          how it looked on your first visit. This can’t be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button color="error" variant="contained" onClick={onConfirmReset}>
          Reset
        </Button>
      </DialogActions>
    </Dialog>
  );
}
