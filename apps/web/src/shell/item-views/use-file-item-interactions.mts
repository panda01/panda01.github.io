import { useCallback } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import type { DraggableSyntheticListeners } from '@dnd-kit/core';
import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import { findItemDropDestination } from '../drag-and-drop/file-drag-and-drop.mts';
import {
  useDraggableFileItem,
  useFileDropTarget,
} from '../drag-and-drop/use-file-drag-and-drop.mts';
import {
  findNeighborItemElement,
  findSelectionMoveDirection,
  itemPathAttributeName,
} from './item-view-navigation.mts';

/** What happens when the visitor interacts with an item (on the desktop or in Finder). */
export interface FileItemInteractionHandlers {
  /** Selects the item (click, right-click, or arrow keys). */
  onSelect: () => void;
  /** Opens the item (double-click or Enter). */
  onOpen: () => void;
  /** Opens or closes Quick Look on the item (Space). */
  onToggleQuickLook: () => void;
  /** Opens the item's right-click menu at the pointer. */
  onOpenContextMenu: (contextMenuEvent: MouseEvent<HTMLElement>) => void;
  /** Selects another item in the same view (arrow keys), given its path. */
  onSelectNeighbor: (neighborItemPath: string) => void;
}

/** Props to spread onto an item's element. */
export interface FileItemElementProps {
  ref: (itemElement: HTMLElement | null) => void;
  [itemPathAttributeName]: string;
  onClick: (clickEvent: MouseEvent<HTMLElement>) => void;
  onDoubleClick: (doubleClickEvent: MouseEvent<HTMLElement>) => void;
  onKeyDown: (keyboardEvent: KeyboardEvent<HTMLElement>) => void;
  onKeyUp: (keyboardEvent: KeyboardEvent<HTMLElement>) => void;
  onContextMenu: (contextMenuEvent: MouseEvent<HTMLElement>) => void;
}

/**
 * Everything an item's element needs. Spread `dragListeners`, `dropTargetAttributes` and
 * `itemElementProps` onto it.
 */
export interface FileItemInteractions {
  /** Pointer and touch handlers that start a drag. */
  dragListeners: NonNullable<DraggableSyntheticListeners>;
  /** Marks folders (and aliases) as drop targets. */
  dropTargetAttributes: Record<string, string>;
  itemElementProps: FileItemElementProps;
  /** Whether the item is being dragged (drawn faded). */
  isBeingDragged: boolean;
  /** Whether a dragged item is over this folder and can be dropped into it. */
  isDropHighlighted: boolean;
}

/**
 * Wires up everything an item responds to, the same way on the desktop and in every Finder view:
 * click selects (and focuses, which Safari does not do for buttons by itself), double-click and
 * Enter open, Space toggles Quick Look, arrow keys move the selection, right-click opens the menu,
 * the item can be dragged, and folders (and aliases to folders) accept dropped items.
 * @param item - The item.
 * @param placeId - Where it is shown (for example "desktop" or a Finder window id).
 * @param isRenaming - Whether its name field is open (dragging is off meanwhile).
 * @param interactionHandlers - What each interaction does.
 * @returns Props for the item's element and its drag-and-drop state.
 */
export function useFileItemInteractions(
  item: FileSystemItem,
  placeId: string,
  isRenaming: boolean,
  interactionHandlers: FileItemInteractionHandlers,
): FileItemInteractions {
  const { dragListeners, setDragNodeRef, isBeingDragged } = useDraggableFileItem(
    item,
    placeId,
    !isRenaming,
  );
  // The item's id keeps drop targets unique even when two aliases point at the same folder.
  const { setDropNodeRef, dropTargetAttributes, isDropHighlighted } = useFileDropTarget(
    `${placeId}:${item.id}`,
    findItemDropDestination(item),
  );
  const setItemElement = useCallback(
    (itemElement: HTMLElement | null) => {
      setDragNodeRef(itemElement);
      setDropNodeRef(itemElement);
    },
    [setDragNodeRef, setDropNodeRef],
  );
  const { onSelect, onOpen, onToggleQuickLook, onOpenContextMenu, onSelectNeighbor } =
    interactionHandlers;

  return {
    dragListeners,
    dropTargetAttributes,
    itemElementProps: {
      ref: setItemElement,
      [itemPathAttributeName]: item.path,
      /**
       * Selects and focuses the item.
       * @param clickEvent - The click.
       */
      onClick: (clickEvent) => {
        clickEvent.stopPropagation();
        clickEvent.currentTarget.focus();
        onSelect();
      },
      /**
       * Opens the item.
       * @param doubleClickEvent - The double-click.
       */
      onDoubleClick: (doubleClickEvent) => {
        doubleClickEvent.stopPropagation();
        onOpen();
      },
      /**
       * Handles Enter, Space and the arrow keys.
       * @param keyboardEvent - The key press.
       */
      onKeyDown: (keyboardEvent) => {
        if (keyboardEvent.key === 'Enter') {
          keyboardEvent.preventDefault();
          onOpen();
          return;
        }
        if (keyboardEvent.key === ' ') {
          keyboardEvent.preventDefault();
          onToggleQuickLook();
          return;
        }
        const selectionMoveDirection = findSelectionMoveDirection(keyboardEvent.key);
        if (selectionMoveDirection === undefined) {
          return;
        }
        keyboardEvent.preventDefault();
        const neighborElement = findNeighborItemElement(
          keyboardEvent.currentTarget,
          selectionMoveDirection,
        );
        const neighborItemPath = neighborElement?.getAttribute(itemPathAttributeName);
        if (neighborElement !== undefined && typeof neighborItemPath === 'string') {
          neighborElement.focus();
          onSelectNeighbor(neighborItemPath);
        }
      },
      /**
       * Stops the Space bar from also "clicking" the item when released.
       * @param keyboardEvent - The key release.
       */
      onKeyUp: (keyboardEvent) => {
        if (keyboardEvent.key === ' ') {
          keyboardEvent.preventDefault();
        }
      },
      /**
       * Selects the item and opens its menu.
       * @param contextMenuEvent - The right-click.
       */
      onContextMenu: (contextMenuEvent) => {
        contextMenuEvent.preventDefault();
        contextMenuEvent.stopPropagation();
        onSelect();
        onOpenContextMenu(contextMenuEvent);
      },
    },
    isBeingDragged,
    isDropHighlighted,
  };
}
