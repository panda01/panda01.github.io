import { beforeEach, describe, expect, it } from 'vitest';
import { createWindowManagerStore } from '../../system/window-manager/window-manager-store.mts';
import type { WindowManagerStore } from '../../system/window-manager/window-manager-store.mts';
import { createWindowFrameHandlers } from './window-frame-handlers.mts';

let windowStore: WindowManagerStore;
let nextWindowNumber: number;

beforeEach(() => {
  nextWindowNumber = 1;
  windowStore = createWindowManagerStore(
    { width: 1280, height: 690 },
    () => `w${String(nextWindowNumber++)}`,
  );
  for (const itemPath of ['/a', '/b']) {
    windowStore.getState().openWindow({
      appId: 'get-info',
      title: itemPath,
      defaultSize: { width: 300, height: 300 },
      launchArgument: itemPath,
      allowsMultipleWindows: true,
    });
  }
});

describe('createWindowFrameHandlers', () => {
  it('focuses the window when a resize starts', () => {
    createWindowFrameHandlers('w1', windowStore).handleInteractionStart();

    expect(windowStore.getState().windowStackOrder).toEqual(['w2', 'w1']);
  });

  it('keeps a zoomed window zoomed when a resize ends without changing it', () => {
    windowStore.getState().toggleWindowZoom('w1');
    const zoomedBounds = windowStore.getState().windowsById.w1?.bounds ?? { x: -1, y: -1 };
    const unchangedFrameElement = document.createElement('div');
    Object.defineProperty(unchangedFrameElement, 'offsetWidth', { value: 1280 });
    Object.defineProperty(unchangedFrameElement, 'offsetHeight', { value: 606 });

    createWindowFrameHandlers('w1', windowStore).handleResizeStop(
      undefined,
      'right',
      unchangedFrameElement,
      undefined,
      { x: zoomedBounds.x, y: zoomedBounds.y },
    );

    expect(windowStore.getState().windowsById.w1?.isZoomed).toBe(true);
  });

  it('ignores resizes of a window that has closed', () => {
    const resizedFrameElement = document.createElement('div');

    createWindowFrameHandlers('closed-window', windowStore).handleResizeStop(
      undefined,
      'right',
      resizedFrameElement,
      undefined,
      { x: 1, y: 1 },
    );

    expect(windowStore.getState().windowsById['closed-window']).toBeUndefined();
  });

  it('saves the bounds where a resize ended, using the frame element size', () => {
    const resizedFrameElement = document.createElement('div');
    Object.defineProperty(resizedFrameElement, 'offsetWidth', { value: 420 });
    Object.defineProperty(resizedFrameElement, 'offsetHeight', { value: 360 });

    createWindowFrameHandlers('w1', windowStore).handleResizeStop(
      undefined,
      'bottomRight',
      resizedFrameElement,
      undefined,
      { x: 40, y: 50 },
    );

    expect(windowStore.getState().windowsById.w1?.bounds).toEqual({
      x: 40,
      y: 50,
      width: 420,
      height: 360,
    });
  });
});
