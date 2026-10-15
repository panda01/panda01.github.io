import type { Announcements, Collision, CollisionDetection } from '@dnd-kit/core';
import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import { getFolderDisplayName } from '../../system/fs/path-utilities.mts';
import type { FileDropDestination } from '../../system/item-actions/item-actions.mts';

/** HTML attribute that marks an element as a drop target, holding its drop target id. */
export const dropTargetIdAttributeName = 'data-drop-target-id';

/** What a dragged item carries (dnd-kit's `active.data.current`). */
export interface DraggedFileItemData {
  draggedItem: FileSystemItem;
}

/** What a drop target carries (dnd-kit's `over.data.current`). */
export interface FileDropTargetData {
  dropDestination: FileDropDestination;
}

/**
 * Builds a unique id for a draggable item. The same file can be shown in several places at once
 * (on the desktop and in a Finder window), so the place is part of the id.
 * @param placeId - Where the item is shown, for example "desktop" or a Finder window id.
 * @param itemId - The item's filesystem id.
 * @returns The draggable id.
 */
export function buildDraggableItemId(placeId: string, itemId: string): string {
  return `drag:${placeId}:${itemId}`;
}

/**
 * Builds a unique id for a drop target.
 * @param placeId - Where the target is shown, for example "dock" or a Finder window id.
 * @param dropDestination - Where dropped items go.
 * @returns The drop target id.
 */
export function buildDropTargetId(placeId: string, dropDestination: FileDropDestination): string {
  const destinationKey =
    dropDestination.kind === 'trash' ? 'trash' : `folder:${dropDestination.folderPath}`;
  return `drop:${placeId}:${destinationKey}`;
}

/**
 * Decides whether items can be dropped onto an item: folders accept items, and so do aliases (the
 * items go into the alias's original). Files and web links accept nothing.
 * @param item - The item under the dragged item.
 * @returns Where dropped items go, or undefined when the item accepts nothing.
 */
export function findItemDropDestination(item: FileSystemItem): FileDropDestination | undefined {
  if (item.kind === 'folder') {
    return { kind: 'folder', folderPath: item.path };
  }
  if (item.linkTarget?.kind === 'path') {
    return { kind: 'folder', folderPath: item.linkTarget.path };
  }
  return undefined;
}

/**
 * Reads the dragged item from dnd-kit's active data.
 * @param draggableData - `active.data.current`.
 * @returns The dragged item, or undefined for anything else.
 */
export function readDraggedItem(draggableData: unknown): FileSystemItem | undefined {
  const isDraggedFileItemData =
    typeof draggableData === 'object' && draggableData !== null && 'draggedItem' in draggableData;
  return isDraggedFileItemData ? (draggableData as DraggedFileItemData).draggedItem : undefined;
}

/**
 * Reads where dropped items go from dnd-kit's drop target data.
 * @param dropTargetData - `over.data.current`.
 * @returns The drop destination, or undefined for anything else.
 */
export function readDropDestination(dropTargetData: unknown): FileDropDestination | undefined {
  const isFileDropTargetData =
    typeof dropTargetData === 'object' &&
    dropTargetData !== null &&
    'dropDestination' in dropTargetData;
  return isFileDropTargetData ? (dropTargetData as FileDropTargetData).dropDestination : undefined;
}

/**
 * Creates dnd-kit's collision detection for the desktop: the drop target is whatever target is
 * actually visible under the pointer. dnd-kit's built-in strategies only compare rectangles, so
 * with overlapping windows they could pick a folder in a window hidden behind another one; asking
 * the page which element is on top respects window stacking and nesting (a folder inside a Finder
 * window wins over the window's background).
 * @param findElementAtPoint - Returns the top-most element at a screen point
 *   (`document.elementFromPoint`, replaceable in tests).
 * @returns The collision detection function.
 */
export function createTopmostDropTargetCollisionDetection(
  findElementAtPoint: (pointX: number, pointY: number) => Element | null,
): CollisionDetection {
  return ({ pointerCoordinates, droppableContainers }): Collision[] => {
    if (pointerCoordinates === null) {
      return [];
    }
    const elementUnderPointer = findElementAtPoint(pointerCoordinates.x, pointerCoordinates.y);
    const dropTargetId = elementUnderPointer
      ?.closest(`[${dropTargetIdAttributeName}]`)
      ?.getAttribute(dropTargetIdAttributeName);
    const matchingDropTarget = droppableContainers.find(
      (droppableContainer) => droppableContainer.id === dropTargetId,
    );
    if (matchingDropTarget === undefined) {
      return [];
    }
    return [
      { id: matchingDropTarget.id, data: { droppableContainer: matchingDropTarget, value: 0 } },
    ];
  };
}

/**
 * Describes a drop destination for screen reader announcements.
 * @param dropDestination - Where items would go.
 * @returns For example "the Trash" or "“Documents”".
 */
export function describeDropDestination(dropDestination: FileDropDestination): string {
  return dropDestination.kind === 'trash'
    ? 'the Trash'
    : `“${getFolderDisplayName(dropDestination.folderPath)}”`;
}

/**
 * Names the dragged item for an announcement.
 * @param draggableData - `active.data.current`.
 * @returns The item's name in quotes, or "The item".
 */
function nameDraggedItem(draggableData: unknown): string {
  const draggedItem = readDraggedItem(draggableData);
  return draggedItem === undefined ? 'The item' : `“${draggedItem.name}”`;
}

/**
 * Names the drop target under the dragged item for an announcement.
 * @param dropTargetData - `over.data.current`, if over a target.
 * @returns The destination's description, or undefined when not over a target.
 */
function nameDropTarget(dropTargetData: unknown): string | undefined {
  const dropDestination = readDropDestination(dropTargetData);
  return dropDestination === undefined ? undefined : describeDropDestination(dropDestination);
}

/** What screen readers hear while an item is dragged, using item and folder names. */
export const fileDragAnnouncements: Announcements = {
  /**
   * Announces the start of a drag.
   * @param dragArguments - The dragged item.
   * @param dragArguments.active - The dragged item.
   * @returns The announcement.
   */
  onDragStart: ({ active }) => `Picked up ${nameDraggedItem(active.data.current)}.`,
  /**
   * Announces the drop target under the dragged item.
   * @param dragArguments - The dragged item and the target under it.
   * @param dragArguments.active - The dragged item.
   * @param dragArguments.over - The target under it.
   * @returns The announcement.
   */
  onDragOver: ({ active, over }) => {
    const dropTargetName = nameDropTarget(over?.data.current);
    const draggedItemName = nameDraggedItem(active.data.current);
    return dropTargetName === undefined
      ? `${draggedItemName} is not over a folder.`
      : `${draggedItemName} is over ${dropTargetName}.`;
  },
  /**
   * Announces a drop.
   * @param dragArguments - The dragged item and the target it was dropped on.
   * @param dragArguments.active - The dropped item.
   * @param dragArguments.over - The target it was dropped on.
   * @returns The announcement.
   */
  onDragEnd: ({ active, over }) => {
    const dropTargetName = nameDropTarget(over?.data.current);
    const draggedItemName = nameDraggedItem(active.data.current);
    return dropTargetName === undefined
      ? `${draggedItemName} was dropped where it started.`
      : `${draggedItemName} was dropped on ${dropTargetName}.`;
  },
  /**
   * Announces a cancelled drag.
   * @param dragArguments - The dragged item.
   * @param dragArguments.active - The dragged item.
   * @returns The announcement.
   */
  onDragCancel: ({ active }) => `Moving ${nameDraggedItem(active.data.current)} was cancelled.`,
};

/** Instructions linked to draggable items for screen readers. */
export const fileDragScreenReaderInstructions = {
  draggable:
    'To move this item, drag it onto a folder or the Trash. You can also use its right-click menu.',
};
