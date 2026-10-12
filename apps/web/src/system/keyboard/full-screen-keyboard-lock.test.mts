import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  enterFullScreenWithKeyboardLock,
  exitFullScreenAndReleaseKeyboard,
  findKeyboardLockApi,
} from './full-screen-keyboard-lock.mts';

/**
 * Builds a fake navigator, optionally with the Keyboard Lock API.
 * @param keyboardApi - The fake `navigator.keyboard`, or undefined for unsupported browsers.
 * @returns The fake navigator.
 */
function createFakeNavigator(keyboardApi?: unknown): Navigator {
  return { keyboard: keyboardApi } as unknown as Navigator;
}

/**
 * Builds a fake element whose full-screen request succeeds.
 * @returns The fake element and its spy.
 */
function createFullScreenCapableElement() {
  const requestFullscreen = vi.fn(() => Promise.resolve());
  return { element: { requestFullscreen } as unknown as HTMLElement, requestFullscreen };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('findKeyboardLockApi', () => {
  it('returns the API only when both lock and unlock exist', () => {
    const keyboardApi = { lock: vi.fn(), unlock: vi.fn() };
    expect(findKeyboardLockApi(createFakeNavigator(keyboardApi))).toBe(keyboardApi);
    expect(findKeyboardLockApi(createFakeNavigator({ lock: vi.fn() }))).toBeUndefined();
    expect(findKeyboardLockApi(createFakeNavigator())).toBeUndefined();
  });
});

describe('enterFullScreenWithKeyboardLock', () => {
  it('requests full-screen and locks the shortcut keys', async () => {
    const lock = vi.fn(() => Promise.resolve());
    const { element, requestFullscreen } = createFullScreenCapableElement();

    const isLocked = await enterFullScreenWithKeyboardLock(
      element,
      createFakeNavigator({ lock, unlock: vi.fn() }),
    );

    expect(requestFullscreen).toHaveBeenCalled();
    expect(lock).toHaveBeenCalledWith(['KeyW', 'KeyQ', 'KeyM', 'KeyN', 'Tab', 'Space']);
    expect(isLocked).toBe(true);
  });

  it('still goes full-screen in browsers without Keyboard Lock', async () => {
    const { element, requestFullscreen } = createFullScreenCapableElement();

    expect(await enterFullScreenWithKeyboardLock(element, createFakeNavigator())).toBe(false);
    expect(requestFullscreen).toHaveBeenCalled();
  });

  it('reports a refused lock without failing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const lock = vi.fn(() => Promise.reject(new Error('not allowed')));
    const { element } = createFullScreenCapableElement();

    expect(
      await enterFullScreenWithKeyboardLock(
        element,
        createFakeNavigator({ lock, unlock: vi.fn() }),
      ),
    ).toBe(false);
  });
});

describe('exitFullScreenAndReleaseKeyboard', () => {
  it('unlocks keys and exits full-screen when the page is full-screen', async () => {
    const unlock = vi.fn();
    const exitFullscreen = vi.fn(() => Promise.resolve());
    const fakeDocument = { fullscreenElement: {}, exitFullscreen } as unknown as Document;

    await exitFullScreenAndReleaseKeyboard(
      fakeDocument,
      createFakeNavigator({ lock: vi.fn(), unlock }),
    );

    expect(unlock).toHaveBeenCalled();
    expect(exitFullscreen).toHaveBeenCalled();
  });

  it('does not call exitFullscreen when the page is not full-screen', async () => {
    const exitFullscreen = vi.fn();
    const fakeDocument = { fullscreenElement: null, exitFullscreen } as unknown as Document;

    await exitFullScreenAndReleaseKeyboard(fakeDocument, createFakeNavigator());

    expect(exitFullscreen).not.toHaveBeenCalled();
  });
});
