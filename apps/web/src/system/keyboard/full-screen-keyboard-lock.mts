import { keyCodesCapturedInFullScreen } from './desktop-keyboard-shortcuts.mts';

/**
 * The experimental Keyboard Lock API (Chromium browsers only). It is not part of TypeScript's DOM
 * types, so its shape is declared here.
 */
interface KeyboardLockApi {
  lock: (keyCodes?: readonly string[]) => Promise<void>;
  unlock: () => void;
}

/**
 * Returns the Keyboard Lock API when this browser supports it.
 * @param browserNavigator - The navigator to inspect (replaceable in tests).
 * @returns The API, or undefined in browsers without it (Safari, Firefox).
 */
export function findKeyboardLockApi(
  browserNavigator: Navigator = navigator,
): KeyboardLockApi | undefined {
  const navigatorWithKeyboard = browserNavigator as Navigator & {
    keyboard?: Partial<KeyboardLockApi>;
  };
  const keyboardApi = navigatorWithKeyboard.keyboard;
  const supportsKeyboardLock =
    typeof keyboardApi?.lock === 'function' && typeof keyboardApi.unlock === 'function';
  return supportsKeyboardLock ? (keyboardApi as KeyboardLockApi) : undefined;
}

/**
 * Enters full-screen and, where supported, captures the desktop's shortcut keys so the real ⌘
 * shortcuts (⌘W, ⌘Q, ⌘M, ⌘N, ⌘Tab, ⌘Space) reach the desktop instead of the browser.
 * @param fullScreenElement - The element to show full-screen (normally the whole page).
 * @param browserNavigator - The navigator to use (replaceable in tests).
 * @returns Whether ⌘ shortcuts are now captured.
 */
export async function enterFullScreenWithKeyboardLock(
  fullScreenElement: HTMLElement = document.documentElement,
  browserNavigator: Navigator = navigator,
): Promise<boolean> {
  await fullScreenElement.requestFullscreen();
  const keyboardLockApi = findKeyboardLockApi(browserNavigator);
  if (keyboardLockApi === undefined) {
    return false;
  }
  try {
    await keyboardLockApi.lock(keyCodesCapturedInFullScreen);
    return true;
  } catch (keyboardLockError) {
    console.warn(
      'Keyboard Lock was refused; ⌘ shortcuts stay with the browser.',
      keyboardLockError,
    );
    return false;
  }
}

/**
 * Releases captured keys and leaves full-screen.
 * @param browserDocument - The document to leave full-screen (replaceable in tests).
 * @param browserNavigator - The navigator to use (replaceable in tests).
 * @returns Resolves once full-screen has been exited.
 */
export async function exitFullScreenAndReleaseKeyboard(
  browserDocument: Document = document,
  browserNavigator: Navigator = navigator,
): Promise<void> {
  findKeyboardLockApi(browserNavigator)?.unlock();
  if (browserDocument.fullscreenElement !== null) {
    await browserDocument.exitFullscreen();
  }
}
