import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { InputBase } from '@mui/material';

/** Props for the inline name field. */
export interface InlineRenameFieldProps {
  /** The item's current name, shown selected when the field opens. */
  initialName: string;
  /** How many characters to select at first (a file's name without its extension). */
  selectedCharacterCount: number;
  /** Called once: with the typed name (Enter or clicking away), or undefined (Escape). */
  onFinish: (requestedName: string | undefined) => void;
}

/**
 * The field that replaces an item's name while it is being renamed, like Finder's: it opens
 * focused with the name (minus any extension) selected; Enter or clicking elsewhere keeps the new
 * name and Escape cancels.
 * @param props - The name, selection and completion handler.
 * @param props.initialName - The current name.
 * @param props.selectedCharacterCount - How much of the name to select.
 * @param props.onFinish - Receives the new name, or undefined when cancelled.
 * @returns The name field.
 */
export function InlineRenameField({
  initialName,
  selectedCharacterCount,
  onFinish,
}: InlineRenameFieldProps): JSX.Element {
  const [draftName, setDraftName] = useState(initialName);
  const nameInputRef = useRef<HTMLInputElement>(null);
  // Enter is followed by a blur when the field disappears; only the first one counts.
  const hasFinishedRef = useRef(false);

  useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.setSelectionRange(0, selectedCharacterCount);
  }, [selectedCharacterCount]);

  /**
   * Reports the result once.
   * @param requestedName - The new name, or undefined when cancelled.
   */
  function finishRenaming(requestedName: string | undefined): void {
    if (hasFinishedRef.current) {
      return;
    }
    hasFinishedRef.current = true;
    onFinish(requestedName);
  }

  return (
    <InputBase
      value={draftName}
      inputRef={nameInputRef}
      onChange={(changeEvent) => {
        setDraftName(changeEvent.target.value);
      }}
      onKeyDown={(keyboardEvent) => {
        // Keys typed into the name must not reach the item, the window or desktop shortcuts.
        keyboardEvent.stopPropagation();
        if (keyboardEvent.key === 'Enter') {
          keyboardEvent.preventDefault();
          finishRenaming(draftName);
        } else if (keyboardEvent.key === 'Escape') {
          keyboardEvent.preventDefault();
          finishRenaming(undefined);
        }
      }}
      onBlur={() => {
        finishRenaming(draftName);
      }}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
      }}
      onDoubleClick={(doubleClickEvent) => {
        doubleClickEvent.stopPropagation();
      }}
      slotProps={{ input: { 'aria-label': 'Name', spellCheck: false } }}
      sx={{
        width: '100%',
        fontSize: 12,
        px: 0.5,
        borderRadius: 0.75,
        bgcolor: 'background.paper',
        color: 'text.primary',
        outline: '2px solid',
        outlineColor: 'primary.main',
        '& input': { p: '1px 0', textAlign: 'center' },
      }}
    />
  );
}
