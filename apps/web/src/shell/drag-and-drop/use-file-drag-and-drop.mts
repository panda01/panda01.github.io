import { useId } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { DraggableSyntheticListeners } from '@dnd-kit/core';
import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import { decideFileDropOperation } from '../../system/item-actions/item-actions.mts';
import type { FileDropDestination } from '../../system/item-actions/item-actions.mts';
import {
  buildDraggableItemId,
  buildDropTargetId,
  dropTargetIdAttributeName,
  readDraggedItem,
} from './file-drag-and-drop.mts';
import type { DraggedFileItemData, FileDropTargetData } from './file-drag-and-drop.mts';

/** What an item shown on screen needs in order to be dragged. */
export interface DraggableFileItem {
  /** Pointer and touch handlers that start a drag; spread them onto the item's element. */
  dragListeners: NonNullable<DraggableSyntheticListeners>;
  setDragNodeRef: (element: HTMLElement | null) => void;
  /** Whether this item is being dragged right now (it is drawn faded meanwhile). */
  isBeingDragged: boolean;
}

/** What a folder, the Trash, or a window background needs in order to accept drops. */
export interface FileDropTarget {
  setDropNodeRef: (element: HTMLElement | null) => void;
  /** Marks the element as a drop target for the collision detection; spread it onto the element. */
  dropTargetAttributes: Record<string, string>;
  /** Whether a dragged item is over this target and dropping it here would do something. */
  isDropHighlighted: boolean;
}

/**
 * Makes an item draggable.
 * @param item - The item.
 * @param placeId - Where it is shown (for example "desktop" or a Finder window id).
 * @param isDragEnabled - False while the item cannot be dragged (for example while being renamed).
 * @returns Handlers, ref and drag state for the item's element.
 */
export function useDraggableFileItem(
  item: FileSystemItem,
  placeId: string,
  isDragEnabled = true,
): DraggableFileItem {
  const draggedItemData: DraggedFileItemData = { draggedItem: item };
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: buildDraggableItemId(placeId, item.id),
    data: draggedItemData,
    disabled: !isDragEnabled,
  });
  return { dragListeners: listeners ?? {}, setDragNodeRef: setNodeRef, isBeingDragged: isDragging };
}

/**
 * Makes an element accept dropped items (a folder, an alias to a folder, the Trash, or the empty
 * background of a folder view). Pass no destination for elements that accept nothing, such as files.
 * @param placeId - Where the element is shown.
 * @param dropDestination - Where dropped items go, or undefined when the element accepts nothing.
 * @returns Ref, attributes and highlight state for the element.
 */
export function useFileDropTarget(
  placeId: string,
  dropDestination: FileDropDestination | undefined,
): FileDropTarget {
  const disabledTargetId = `drop:${placeId}:disabled:${useId()}`;
  const dropTargetId =
    dropDestination === undefined ? disabledTargetId : buildDropTargetId(placeId, dropDestination);
  const dropTargetData: FileDropTargetData | undefined =
    dropDestination === undefined ? undefined : { dropDestination };
  const { setNodeRef, isOver, active } = useDroppable({
    id: dropTargetId,
    ...(dropTargetData === undefined ? {} : { data: dropTargetData }),
    disabled: dropDestination === undefined,
  });
  const draggedItem = readDraggedItem(active?.data.current);
  const isDropHighlighted =
    isOver &&
    dropDestination !== undefined &&
    draggedItem !== undefined &&
    decideFileDropOperation(draggedItem, dropDestination) !== 'none';
  return {
    setDropNodeRef: setNodeRef,
    dropTargetAttributes:
      dropDestination === undefined ? {} : { [dropTargetIdAttributeName]: dropTargetId },
    isDropHighlighted,
  };
}
