import { act, fireEvent, screen, within } from '@testing-library/react';
import type { Active, DroppableContainer, Over } from '@dnd-kit/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopSession } from '../../system/desktop-session/desktop-session.mts';
import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import { useDesktopNoticeStore } from '../../system/notices/desktop-notice-store.mts';
import {
  endTestDesktopSession,
  renderInDesktopSession,
  startTestDesktopSession,
} from '../../test-support/desktop-test-session.tsx';
import { DesktopSurface } from '../desktop/DesktopSurface.tsx';
import { Dock } from '../dock/Dock.tsx';
import {
  blockFileDropsFromComputer,
  isDragFromComputerFiles,
} from './computer-file-drop-blocker.mts';
import {
  buildDraggableItemId,
  buildDropTargetId,
  createTopmostDropTargetCollisionDetection,
  describeDropDestination,
  dropTargetIdAttributeName,
  fileDragAnnouncements,
  findItemDropDestination,
  readDraggedItem,
  readDropDestination,
} from './file-drag-and-drop.mts';
import { FileDragAndDropProvider } from './FileDragAndDropProvider.tsx';

/**
 * Builds a filesystem item with sensible defaults.
 * @param overrides - Fields to change.
 * @returns The item.
 */
function buildItem(overrides: Partial<FileSystemItem>): FileSystemItem {
  return {
    id: 'x',
    parentId: 'p',
    name: 'Notes.txt',
    path: '/Users/guest/Desktop/Notes.txt',
    kind: 'file',
    mimeType: 'text/plain',
    sizeInBytes: 0,
    createdAt: 0,
    modifiedAt: 0,
    ...overrides,
  };
}

describe('drag-and-drop ids and data', () => {
  it('builds ids that include where the item or target is shown', () => {
    expect(buildDraggableItemId('desktop', 'abc')).toBe('drag:desktop:abc');
    expect(buildDropTargetId('dock', { kind: 'trash' })).toBe('drop:dock:trash');
    expect(buildDropTargetId('w1', { kind: 'folder', folderPath: '/Users/guest' })).toBe(
      'drop:w1:folder:/Users/guest',
    );
  });

  it('reads dragged items and drop destinations, ignoring anything else', () => {
    const draggedItem = buildItem({});
    expect(readDraggedItem({ draggedItem })).toBe(draggedItem);
    expect(readDraggedItem(undefined)).toBeUndefined();
    expect(readDraggedItem({ other: true })).toBeUndefined();
    expect(readDropDestination({ dropDestination: { kind: 'trash' } })).toEqual({ kind: 'trash' });
    expect(readDropDestination(null)).toBeUndefined();
  });

  it('lets folders and aliases accept drops, but not files or web links', () => {
    expect(findItemDropDestination(buildItem({ kind: 'folder', path: '/a' }))).toEqual({
      kind: 'folder',
      folderPath: '/a',
    });
    expect(
      findItemDropDestination(
        buildItem({ kind: 'link', linkTarget: { kind: 'path', path: '/Users/guest/Projects' } }),
      ),
    ).toEqual({ kind: 'folder', folderPath: '/Users/guest/Projects' });
    expect(findItemDropDestination(buildItem({}))).toBeUndefined();
    expect(
      findItemDropDestination(
        buildItem({ kind: 'link', linkTarget: { kind: 'url', url: 'https://example.com' } }),
      ),
    ).toBeUndefined();
  });
});

describe('createTopmostDropTargetCollisionDetection', () => {
  /**
   * Runs the collision detection with a pointer position and the given drop target ids.
   * @param elementAtPoint - What the page reports under the pointer.
   * @param droppableIds - The registered drop targets.
   * @param pointerCoordinates - The pointer position, or null for keyboard drags.
   * @returns The ids of the detected collisions.
   */
  function detectCollisions(
    elementAtPoint: Element | null,
    droppableIds: string[],
    pointerCoordinates: { x: number; y: number } | null = { x: 5, y: 5 },
  ): string[] {
    const collisionDetection = createTopmostDropTargetCollisionDetection(() => elementAtPoint);
    const droppableContainers = droppableIds.map(
      (droppableId) => ({ id: droppableId }) as unknown as DroppableContainer,
    );
    const emptyRect = { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
    return collisionDetection({
      active: {
        id: 'drag',
        data: { current: undefined },
        rect: { current: { initial: null, translated: null } },
      },
      collisionRect: emptyRect,
      droppableRects: new Map(),
      droppableContainers,
      pointerCoordinates,
    }).map((collision) => String(collision.id));
  }

  it('picks the drop target that contains the element under the pointer', () => {
    const dropTargetElement = document.createElement('div');
    dropTargetElement.setAttribute(dropTargetIdAttributeName, 'drop:w1:folder:/a');
    const iconInsideTarget = document.createElement('span');
    dropTargetElement.append(iconInsideTarget);

    expect(detectCollisions(iconInsideTarget, ['drop:w2:folder:/b', 'drop:w1:folder:/a'])).toEqual([
      'drop:w1:folder:/a',
    ]);
  });

  it('finds nothing without a pointer, over plain elements, or for unregistered targets', () => {
    const dropTargetElement = document.createElement('div');
    dropTargetElement.setAttribute(dropTargetIdAttributeName, 'drop:gone');

    expect(detectCollisions(dropTargetElement, ['drop:gone'], null)).toEqual([]);
    expect(detectCollisions(null, ['drop:gone'])).toEqual([]);
    expect(detectCollisions(document.createElement('div'), ['drop:gone'])).toEqual([]);
    expect(detectCollisions(dropTargetElement, ['drop:other'])).toEqual([]);
  });
});

describe('fileDragAnnouncements', () => {
  const emptyRect = { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };

  /**
   * Builds dnd-kit's description of the dragged item.
   * @param draggableData - What the dragged item carries.
   * @returns The active draggable.
   */
  function buildActive(draggableData: unknown): Active {
    return {
      id: 'drag',
      data: { current: draggableData as Active['data']['current'] },
      rect: { current: { initial: null, translated: null } },
    };
  }

  /**
   * Builds dnd-kit's description of the drop target under the dragged item.
   * @param folderPath - The target folder.
   * @returns The drop target.
   */
  function buildOverFolder(folderPath: string): Over {
    return {
      id: 'drop',
      rect: emptyRect,
      disabled: false,
      data: { current: { dropDestination: { kind: 'folder', folderPath } } },
    };
  }

  const active = buildActive({ draggedItem: buildItem({}) });
  const overProjects = buildOverFolder('/Users/guest/Projects');

  it('describes drags with item and folder names', () => {
    expect(fileDragAnnouncements.onDragStart({ active })).toBe('Picked up “Notes.txt”.');
    expect(fileDragAnnouncements.onDragOver({ active, over: overProjects })).toBe(
      '“Notes.txt” is over “Projects”.',
    );
    expect(fileDragAnnouncements.onDragOver({ active, over: null })).toBe(
      '“Notes.txt” is not over a folder.',
    );
    expect(fileDragAnnouncements.onDragEnd({ active, over: overProjects })).toBe(
      '“Notes.txt” was dropped on “Projects”.',
    );
    expect(fileDragAnnouncements.onDragEnd({ active, over: null })).toBe(
      '“Notes.txt” was dropped where it started.',
    );
    expect(fileDragAnnouncements.onDragCancel({ active: buildActive({}), over: null })).toBe(
      'Moving The item was cancelled.',
    );
    expect(describeDropDestination({ kind: 'trash' })).toBe('the Trash');
  });
});

describe('blockFileDropsFromComputer', () => {
  /**
   * Dispatches a native drag event, optionally carrying drag data.
   * @param eventName - The drag event's name.
   * @param dataTransfer - The drag data, or undefined for an event without any.
   * @returns The dispatched event.
   */
  function dispatchNativeDrag(
    eventName: string,
    dataTransfer: { types: string[]; dropEffect: string } | undefined,
  ): Event {
    const nativeDragEvent = new Event(eventName, { bubbles: true, cancelable: true });
    if (dataTransfer !== undefined) {
      Object.defineProperty(nativeDragEvent, 'dataTransfer', { value: dataTransfer });
    }
    document.body.dispatchEvent(nativeDragEvent);
    return nativeDragEvent;
  }

  it('refuses files dragged in from the computer, and stops when asked', () => {
    const stopBlocking = blockFileDropsFromComputer(window);
    const fileTransfer = { types: ['Files'], dropEffect: 'copy' };

    expect(dispatchNativeDrag('dragenter', fileTransfer).defaultPrevented).toBe(true);
    expect(fileTransfer.dropEffect).toBe('none');
    expect(dispatchNativeDrag('drop', undefined).defaultPrevented).toBe(true);
    expect(
      dispatchNativeDrag('dragover', { types: ['text/plain'], dropEffect: 'copy' })
        .defaultPrevented,
    ).toBe(false);

    stopBlocking();
    expect(dispatchNativeDrag('drop', fileTransfer).defaultPrevented).toBe(false);
  });

  it('treats drags whose contents are hidden as possibly carrying files', () => {
    expect(isDragFromComputerFiles(null)).toBe(true);
  });
});

describe('FileDragAndDropProvider', () => {
  let desktopSession: DesktopSession;

  beforeEach(async () => {
    desktopSession = await startTestDesktopSession();
    // jsdom has no layout; until a test says otherwise, nothing is under the pointer.
    reportElementUnderPointer(document.body);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    useDesktopNoticeStore.getState().dismissNotice();
    await endTestDesktopSession(desktopSession);
  });

  /**
   * Renders the desktop and the Dock inside the drag-and-drop provider.
   * @returns The list of desktop items.
   */
  async function renderDesktopWithDock(): Promise<HTMLElement> {
    renderInDesktopSession(
      <FileDragAndDropProvider>
        <DesktopSurface />
        <Dock />
      </FileDragAndDropProvider>,
      desktopSession,
    );
    const desktopItemList = screen.getByRole('list', { name: 'Desktop items' });
    await within(desktopItemList).findByRole('button', { name: 'About Me.txt' });
    return desktopItemList;
  }

  /**
   * Makes the page report an element as the top-most element under the pointer (jsdom has no
   * layout, so it cannot work this out itself).
   * @param elementUnderPointer - The element to report.
   */
  function reportElementUnderPointer(elementUnderPointer: Element): void {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      /**
       * Answers every "what is under the pointer?" question with the chosen element.
       * @returns The chosen element.
       */
      value: () => elementUnderPointer,
    });
  }

  /**
   * Presses the mouse on an element and moves it far enough to start a drag.
   * @param draggedElement - The element to drag.
   */
  function startDragging(draggedElement: HTMLElement): void {
    fireEvent.mouseDown(draggedElement, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.mouseMove(document, { clientX: 40, clientY: 40 });
    fireEvent.mouseMove(document, { clientX: 80, clientY: 80 });
  }

  /**
   * Drags an element onto another one and releases it.
   * @param draggedElement - The element to drag.
   * @param dropTargetElement - The element under the pointer at the end.
   */
  function dragOnto(draggedElement: HTMLElement, dropTargetElement: Element): void {
    reportElementUnderPointer(dropTargetElement);
    act(() => {
      startDragging(draggedElement);
    });
    act(() => {
      fireEvent.mouseUp(document, { clientX: 80, clientY: 80 });
    });
  }

  it('shows a preview while dragging and moves an item dropped on an alias into its folder', async () => {
    const desktopItemList = await renderDesktopWithDock();
    const aboutMeIcon = within(desktopItemList).getByRole('button', { name: 'About Me.txt' });
    reportElementUnderPointer(within(desktopItemList).getByRole('button', { name: 'Projects' }));

    act(() => {
      startDragging(aboutMeIcon);
    });
    expect(screen.getByTestId('dragged-item-preview')).toHaveTextContent('About Me.txt');
    act(() => {
      fireEvent.mouseUp(document, { clientX: 80, clientY: 80 });
    });

    await vi.waitFor(async () => {
      expect(await desktopSession.fileSystem.exists('/Users/guest/Projects/About Me.txt')).toBe(
        true,
      );
    });
    expect(screen.queryByTestId('dragged-item-preview')).toBeNull();
  });

  it('moves an item dropped on the Dock Trash to the Trash', async () => {
    const desktopItemList = await renderDesktopWithDock();

    dragOnto(
      within(desktopItemList).getByRole('button', { name: 'Resume.pdf' }),
      screen.getByRole('button', { name: 'Trash' }),
    );

    await vi.waitFor(async () => {
      expect(await desktopSession.fileSystem.exists('/Users/guest/.Trash/Resume.pdf')).toBe(true);
    });
  });

  it('reports a drop that fails, and ignores drops outside any drop target', async () => {
    await desktopSession.fileSystem.writeFile(
      '/Users/guest/Projects/About Me.txt',
      new TextEncoder().encode('already here'),
    );
    const desktopItemList = await renderDesktopWithDock();

    dragOnto(
      within(desktopItemList).getByRole('button', { name: 'About Me.txt' }),
      within(desktopItemList).getByRole('button', { name: 'Projects' }),
    );
    await vi.waitFor(() => {
      expect(useDesktopNoticeStore.getState().noticeMessage).toMatch(
        /^Couldn't move “About Me\.txt”/,
      );
    });

    dragOnto(
      within(desktopItemList).getByRole('button', { name: 'Email' }),
      document.createElement('div'),
    );
    expect(await desktopSession.fileSystem.exists('/Users/guest/Desktop/Email')).toBe(true);
  });

  it('cancels a drag with Escape', async () => {
    const desktopItemList = await renderDesktopWithDock();
    reportElementUnderPointer(screen.getByRole('button', { name: 'Trash' }));

    act(() => {
      startDragging(within(desktopItemList).getByRole('button', { name: 'GitHub' }));
    });
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    });

    expect(screen.getByText('Moving “GitHub” was cancelled.')).toBeInTheDocument();
    // dnd-kit removes the preview a moment after the drag ends.
    await vi.waitFor(() => {
      expect(screen.queryByTestId('dragged-item-preview')).toBeNull();
    });
    act(() => {
      fireEvent.mouseUp(document, { clientX: 80, clientY: 80 });
    });
    expect(await desktopSession.fileSystem.exists('/Users/guest/Desktop/GitHub')).toBe(true);
  });
});
