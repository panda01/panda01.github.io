import { describe, expect, it } from 'vitest';
import {
  isTextEntryTarget,
  keyCodesCapturedInFullScreen,
  resolveDesktopShortcutAction,
} from './desktop-keyboard-shortcuts.mts';
import type { ShortcutKeyPress } from './desktop-keyboard-shortcuts.mts';

/**
 * Builds a key press with no modifiers unless overridden.
 * @param code - The physical key code.
 * @param modifiers - Modifier overrides.
 * @returns The key press.
 */
function keyPress(code: string, modifiers: Partial<ShortcutKeyPress> = {}): ShortcutKeyPress {
  return { code, altKey: false, metaKey: false, ctrlKey: false, shiftKey: false, ...modifiers };
}

describe('resolveDesktopShortcutAction', () => {
  it.each([
    ['KeyW', 'close-window'],
    ['KeyQ', 'quit-app'],
    ['KeyM', 'minimize-window'],
    ['KeyN', 'new-window'],
    ['Tab', 'app-switcher'],
    ['Space', 'spotlight'],
  ])('maps ⌥ + %s to %s', (code, expectedAction) => {
    expect(resolveDesktopShortcutAction(keyPress(code, { altKey: true }), false)).toBe(
      expectedAction,
    );
    expect(
      resolveDesktopShortcutAction(keyPress(code, { altKey: true, shiftKey: true }), false),
    ).toBe(expectedAction);
  });

  it('accepts ⌘ shortcuts only while the keyboard is locked in full-screen', () => {
    expect(
      resolveDesktopShortcutAction(keyPress('KeyW', { metaKey: true }), false),
    ).toBeUndefined();
    expect(resolveDesktopShortcutAction(keyPress('KeyW', { metaKey: true }), true)).toBe(
      'close-window',
    );
  });

  it('ignores other keys and modifier combinations', () => {
    expect(resolveDesktopShortcutAction(keyPress('KeyX', { altKey: true }), false)).toBeUndefined();
    expect(resolveDesktopShortcutAction(keyPress('KeyW'), true)).toBeUndefined();
    expect(
      resolveDesktopShortcutAction(keyPress('KeyW', { altKey: true, ctrlKey: true }), false),
    ).toBeUndefined();
    expect(
      resolveDesktopShortcutAction(keyPress('KeyW', { altKey: true, metaKey: true }), true),
    ).toBeUndefined();
  });

  it('lists every shortcut key for the Keyboard Lock request', () => {
    expect(keyCodesCapturedInFullScreen).toEqual(['KeyW', 'KeyQ', 'KeyM', 'KeyN', 'Tab', 'Space']);
  });
});

describe('isTextEntryTarget', () => {
  it('treats form fields, editable content and the Terminal as text entry', () => {
    document.body.innerHTML = `
      <input id="field" />
      <textarea id="area"></textarea>
      <div contenteditable="true"><span id="inside-editable">x</span></div>
      <div class="xterm"><div id="inside-terminal"></div></div>
      <button id="plain-button">ok</button>`;

    for (const textEntryId of ['field', 'area', 'inside-editable', 'inside-terminal']) {
      expect(isTextEntryTarget(document.getElementById(textEntryId))).toBe(true);
    }
    expect(isTextEntryTarget(document.getElementById('plain-button'))).toBe(false);
  });

  it('treats non-elements as not text entry', () => {
    expect(isTextEntryTarget(null)).toBe(false);
    expect(isTextEntryTarget(window)).toBe(false);
  });
});
