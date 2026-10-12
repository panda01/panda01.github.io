/** Window and app actions that have keyboard shortcuts. */
export type DesktopShortcutAction =
  'close-window' | 'quit-app' | 'minimize-window' | 'new-window' | 'app-switcher' | 'spotlight';

/** The parts of a keyboard event that decide which shortcut (if any) was pressed. */
export interface ShortcutKeyPress {
  /** Physical key, for example "KeyW". Used instead of `key` because ⌥W types "∑" on a Mac. */
  code: string;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}

/** Physical keys that trigger an action when combined with ⌥ (or ⌘ while the keyboard is locked). */
export const shortcutActionsByKeyCode: Readonly<Record<string, DesktopShortcutAction>> = {
  KeyW: 'close-window',
  KeyQ: 'quit-app',
  KeyM: 'minimize-window',
  KeyN: 'new-window',
  Tab: 'app-switcher',
  Space: 'spotlight',
};

/** Key codes requested from the Keyboard Lock API in full-screen, so ⌘ versions reach the page. */
export const keyCodesCapturedInFullScreen: readonly string[] =
  Object.keys(shortcutActionsByKeyCode);

/**
 * Decides which desktop action a key press means.
 * - ⌥ + key works everywhere (with or without ⇧).
 * - ⌘ + key only works while the Keyboard Lock API is active (full-screen on Chromium browsers),
 *   because otherwise the browser itself handles ⌘W, ⌘Q, ⌘N and ⌘Tab.
 * @param keyPress - The pressed key and modifiers.
 * @param isKeyboardLockActive - Whether ⌘ shortcuts are currently captured.
 * @returns The action, or undefined when the press is not a desktop shortcut.
 */
export function resolveDesktopShortcutAction(
  keyPress: ShortcutKeyPress,
  isKeyboardLockActive: boolean,
): DesktopShortcutAction | undefined {
  const isOptionShortcut = keyPress.altKey && !keyPress.metaKey && !keyPress.ctrlKey;
  const isLockedCommandShortcut =
    isKeyboardLockActive && keyPress.metaKey && !keyPress.altKey && !keyPress.ctrlKey;
  if (!isOptionShortcut && !isLockedCommandShortcut) {
    return undefined;
  }
  return shortcutActionsByKeyCode[keyPress.code];
}

/**
 * Reports whether keyboard focus is somewhere that types text (form fields, editable content, or
 * the Terminal), where ⌥+letter must type characters instead of triggering shortcuts.
 * @param eventTarget - The element that received the key press.
 * @returns True when shortcuts should be ignored.
 */
export function isTextEntryTarget(eventTarget: EventTarget | null): boolean {
  if (!(eventTarget instanceof Element)) {
    return false;
  }
  const isFormTextField = eventTarget.matches('input, textarea, select');
  const isEditableContent =
    eventTarget.closest('[contenteditable=""], [contenteditable="true"]') !== null;
  const isInsideTerminal = eventTarget.closest('.xterm') !== null;
  return isFormTextField || isEditableContent || isInsideTerminal;
}
