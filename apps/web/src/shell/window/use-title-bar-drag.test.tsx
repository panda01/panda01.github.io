import { act, fireEvent, renderHook, screen, within } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aboutThisMacAppId } from '../../system/app-registry/app-registry.mts';
import type { DesktopSession } from '../../system/desktop-session/desktop-session.mts';
import { createWindowManagerStore } from '../../system/window-manager/window-manager-store.mts';
import type { WindowManagerStore } from '../../system/window-manager/window-manager-store.mts';
import {
  endTestDesktopSession,
  renderInDesktopSession,
  startTestDesktopSession,
} from '../../test-support/desktop-test-session.tsx';
import { computeDraggedWindowPosition, useTitleBarDrag } from './use-title-bar-drag.mts';
import { WindowLayer } from './WindowLayer.tsx';

const desktopArea = { width: 1280, height: 690 };

describe('computeDraggedWindowPosition', () => {
  const dragStart = { startPointerX: 500, startPointerY: 100, startWindowX: 400, startWindowY: 60 };
  const windowBounds = { x: 400, y: 60, width: 440, height: 320 };

  it('moves the window by the pointer’s total movement since the drag began', () => {
    expect(computeDraggedWindowPosition(dragStart, 650, 180, windowBounds, desktopArea)).toEqual({
      x: 550,
      y: 140,
    });
  });

  it('keeps the window below the menu bar and on screen', () => {
    expect(computeDraggedWindowPosition(dragStart, 500, -900, windowBounds, desktopArea)).toEqual({
      x: 400,
      y: 0,
    });
    expect(computeDraggedWindowPosition(dragStart, 5000, 100, windowBounds, desktopArea)).toEqual({
      x: 840,
      y: 60,
    });
  });
});

describe('useTitleBarDrag', () => {
  let windowStore: WindowManagerStore;
  let titleBarElement: HTMLElement;
  let trafficLightElement: HTMLElement;

  beforeEach(() => {
    windowStore = createWindowManagerStore(desktopArea, () => 'w1');
    windowStore.getState().openWindow({
      appId: aboutThisMacAppId,
      title: 'About This Mac',
      defaultSize: { width: 440, height: 320 },
      allowsMultipleWindows: false,
    });
    titleBarElement = document.createElement('div');
    trafficLightElement = document.createElement('button');
    trafficLightElement.className = 'window-traffic-light';
    titleBarElement.append(trafficLightElement);
  });

  /**
   * Builds a pointer event as React would pass it to the title bar handlers.
   * @param pointerFields - Pointer id, position, button and target overrides.
   * @returns The event.
   */
  function pointerEventOnTitleBar(
    pointerFields: Partial<{
      pointerId: number;
      clientX: number;
      clientY: number;
      button: number;
      isPrimary: boolean;
      target: Element;
    }>,
  ): ReactPointerEvent<HTMLElement> {
    return {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      button: 0,
      isPrimary: true,
      target: titleBarElement,
      currentTarget: titleBarElement,
      ...pointerFields,
    } as unknown as ReactPointerEvent<HTMLElement>;
  }

  /**
   * Reads the window's saved bounds.
   * @returns The bounds.
   */
  function readSavedBounds() {
    return windowStore.getState().windowsById.w1?.bounds;
  }

  it('shows the window following the pointer and saves the final position on release', () => {
    const { result } = renderHook(() => useTitleBarDrag('w1', windowStore));
    const startBounds = readSavedBounds() ?? { x: 0, y: 0 };
    const { titleBarDragHandlers } = result.current;

    act(() => {
      titleBarDragHandlers.onPointerDown(pointerEventOnTitleBar({ clientX: 500, clientY: 100 }));
    });
    expect(result.current.liveDragPosition).toBeNull();

    act(() => {
      titleBarDragHandlers.onPointerMove(pointerEventOnTitleBar({ clientX: 520, clientY: 110 }));
      titleBarDragHandlers.onPointerMove(pointerEventOnTitleBar({ clientX: 650, clientY: 180 }));
    });
    expect(result.current.liveDragPosition).toEqual({
      x: startBounds.x + 150,
      y: startBounds.y + 80,
    });
    expect(readSavedBounds()).toEqual(startBounds);
    expect(titleBarElement.hasPointerCapture(1)).toBe(true);

    act(() => {
      titleBarDragHandlers.onPointerUp(pointerEventOnTitleBar({ clientX: 650, clientY: 180 }));
    });

    expect(readSavedBounds()).toMatchObject({ x: startBounds.x + 150, y: startBounds.y + 80 });
    expect(result.current.liveDragPosition).toBeNull();
    expect(titleBarElement.hasPointerCapture(1)).toBe(false);
  });

  // Regression (Phase 1): a click or double-click on a zoomed window's title bar must not un-zoom it.
  it('saves nothing when the window was pressed but not moved', () => {
    windowStore.getState().toggleWindowZoom('w1');
    const { result } = renderHook(() => useTitleBarDrag('w1', windowStore));
    const { titleBarDragHandlers } = result.current;

    act(() => {
      titleBarDragHandlers.onPointerDown(pointerEventOnTitleBar({ clientX: 500, clientY: 100 }));
      titleBarDragHandlers.onPointerUp(pointerEventOnTitleBar({ clientX: 500, clientY: 100 }));
    });

    expect(windowStore.getState().windowsById.w1?.isZoomed).toBe(true);
    expect(result.current.liveDragPosition).toBeNull();
  });

  it('does not drag from a traffic light, with a secondary button, or for a closed window', () => {
    const { result } = renderHook(() => useTitleBarDrag('w1', windowStore));
    const { result: closedWindowDrag } = renderHook(() => useTitleBarDrag('closed', windowStore));
    const { titleBarDragHandlers } = result.current;
    const closedWindowDragHandlers = closedWindowDrag.current.titleBarDragHandlers;
    const startBounds = readSavedBounds();

    act(() => {
      titleBarDragHandlers.onPointerDown(pointerEventOnTitleBar({ target: trafficLightElement }));
      titleBarDragHandlers.onPointerMove(pointerEventOnTitleBar({ clientX: 300 }));
      titleBarDragHandlers.onPointerDown(pointerEventOnTitleBar({ button: 2 }));
      titleBarDragHandlers.onPointerMove(pointerEventOnTitleBar({ clientX: 300 }));
      titleBarDragHandlers.onPointerDown(pointerEventOnTitleBar({ isPrimary: false }));
      titleBarDragHandlers.onPointerMove(pointerEventOnTitleBar({ clientX: 300 }));
      closedWindowDragHandlers.onPointerDown(pointerEventOnTitleBar({}));
      closedWindowDragHandlers.onPointerMove(pointerEventOnTitleBar({ clientX: 300 }));
      closedWindowDragHandlers.onPointerUp(pointerEventOnTitleBar({}));
    });

    expect(result.current.liveDragPosition).toBeNull();
    expect(closedWindowDrag.current.liveDragPosition).toBeNull();
    expect(readSavedBounds()).toEqual(startBounds);
  });

  it('ignores other pointers, finishes on cancel, and stops if the window closes mid-drag', () => {
    const { result } = renderHook(() => useTitleBarDrag('w1', windowStore));
    const startBounds = readSavedBounds() ?? { x: 0, y: 0 };
    const { titleBarDragHandlers } = result.current;

    act(() => {
      titleBarDragHandlers.onPointerDown(pointerEventOnTitleBar({ clientX: 500, clientY: 100 }));
      titleBarDragHandlers.onPointerMove(pointerEventOnTitleBar({ pointerId: 2, clientX: 900 }));
      titleBarDragHandlers.onPointerUp(pointerEventOnTitleBar({ pointerId: 2 }));
    });
    expect(result.current.liveDragPosition).toBeNull();

    act(() => {
      titleBarDragHandlers.onPointerMove(pointerEventOnTitleBar({ clientX: 510, clientY: 100 }));
    });
    expect(result.current.liveDragPosition).toEqual({ x: startBounds.x + 10, y: startBounds.y });
    titleBarElement.releasePointerCapture(1);
    act(() => {
      titleBarDragHandlers.onPointerCancel(pointerEventOnTitleBar({}));
    });
    expect(readSavedBounds()).toMatchObject({ x: startBounds.x + 10 });
    expect(result.current.liveDragPosition).toBeNull();

    act(() => {
      titleBarDragHandlers.onPointerDown(pointerEventOnTitleBar({ clientX: 500, clientY: 100 }));
      windowStore.getState().closeWindow('w1');
      titleBarDragHandlers.onPointerMove(pointerEventOnTitleBar({ clientX: 600, clientY: 100 }));
    });
    expect(result.current.liveDragPosition).toBeNull();
  });
});

describe('dragging a desktop window by its title bar', () => {
  let desktopSession: DesktopSession;

  beforeEach(async () => {
    desktopSession = await startTestDesktopSession();
  });

  afterEach(async () => {
    await endTestDesktopSession(desktopSession);
  });

  it('moves the window with the pointer and keeps it where the pointer was released', async () => {
    renderInDesktopSession(<WindowLayer />, desktopSession);
    let aboutWindowId = '';
    act(() => {
      aboutWindowId = desktopSession.windowManagerStore.getState().openWindow({
        appId: aboutThisMacAppId,
        title: 'About This Mac',
        defaultSize: { width: 440, height: 320 },
        allowsMultipleWindows: false,
      });
    });
    const titleBar = within(
      await screen.findByRole('dialog', { name: 'About This Mac' }),
    ).getByTestId('window-title-bar');
    const startBounds = desktopSession.windowManagerStore.getState().windowsById[aboutWindowId]
      ?.bounds ?? {
      x: 0,
      y: 0,
    };

    fireEvent.pointerDown(titleBar, {
      pointerId: 7,
      button: 0,
      isPrimary: true,
      clientX: 400,
      clientY: 50,
    });
    // jsdom has no layout, so react-rnd's parent-offset correction skews the absolute numbers in the
    // window's transform; the drag is therefore checked by comparing transforms, not by exact values.
    const windowFrame = screen.getByRole('dialog', { name: 'About This Mac' });
    const transformBeforeDrag = windowFrame.style.transform;
    fireEvent.pointerMove(titleBar, { pointerId: 7, clientX: 500, clientY: 90 });
    const transformWhileDragging = windowFrame.style.transform;

    // Regression: the window must follow the pointer during the drag, not only jump on release.
    expect(transformWhileDragging).not.toBe(transformBeforeDrag);
    expect(
      desktopSession.windowManagerStore.getState().windowsById[aboutWindowId]?.bounds,
    ).toMatchObject({ x: startBounds.x, y: startBounds.y });

    fireEvent.pointerUp(titleBar, { pointerId: 7, clientX: 500, clientY: 90 });

    expect(windowFrame.style.transform).toBe(transformWhileDragging);

    expect(
      desktopSession.windowManagerStore.getState().windowsById[aboutWindowId]?.bounds,
    ).toMatchObject({
      x: startBounds.x + 100,
      y: startBounds.y + 40,
    });
  });
});
