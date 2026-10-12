import { useCallback, useEffect, useState } from 'react';
import {
  enterFullScreenWithKeyboardLock,
  exitFullScreenAndReleaseKeyboard,
} from '../../system/keyboard/full-screen-keyboard-lock.mts';

/** Full-screen status and controls for the menu bar. */
export interface FullScreenControls {
  isFullScreen: boolean;
  /** Whether ⌘ shortcuts are captured (full-screen in Chromium browsers). */
  isKeyboardLocked: boolean;
  enterFullScreen: () => void;
  exitFullScreen: () => void;
}

/**
 * Tracks whether the page is full-screen (including when the visitor presses Esc) and offers
 * enter/exit actions that also lock and release the keyboard.
 * @returns The current status and controls.
 */
export function useFullScreenState(): FullScreenControls {
  const [isFullScreen, setIsFullScreen] = useState(() => document.fullscreenElement !== null);
  const [isKeyboardLocked, setIsKeyboardLocked] = useState(false);

  useEffect(() => {
    /**
     * Mirrors the browser's full-screen state; leaving full-screen always releases the keyboard.
     */
    function handleFullScreenChange(): void {
      const isNowFullScreen = document.fullscreenElement !== null;
      setIsFullScreen(isNowFullScreen);
      if (!isNowFullScreen) {
        setIsKeyboardLocked(false);
      }
    }
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);

  const enterFullScreen = useCallback(() => {
    enterFullScreenWithKeyboardLock()
      .then(setIsKeyboardLocked)
      .catch((fullScreenError: unknown) => {
        console.warn('Full-screen was refused.', fullScreenError);
      });
  }, []);

  const exitFullScreen = useCallback(() => {
    exitFullScreenAndReleaseKeyboard().catch((fullScreenError: unknown) => {
      console.warn('Could not leave full-screen.', fullScreenError);
    });
  }, []);

  return { isFullScreen, isKeyboardLocked, enterFullScreen, exitFullScreen };
}
