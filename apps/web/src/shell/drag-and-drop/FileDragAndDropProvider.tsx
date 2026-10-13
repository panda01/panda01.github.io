import { useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { Box } from '@mui/material';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useDesktopSession } from '../../system/desktop-session/desktop-session-context.tsx';
import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import { chooseItemIconKind } from '../../system/fs/item-presentation.mts';
import { performFileDrop } from '../../system/item-actions/item-actions.mts';
import {
  describeFailedAction,
  useDesktopNoticeStore,
} from '../../system/notices/desktop-notice-store.mts';
import { ItemIcon } from '../icons/item-icons.tsx';
import {
  createTopmostDropTargetCollisionDetection,
  fileDragAnnouncements,
  fileDragScreenReaderInstructions,
  readDraggedItem,
  readDropDestination,
} from './file-drag-and-drop.mts';

/** Picks the drop target that is visible under the pointer (see the function's description). */
const topmostDropTargetCollisionDetection = createTopmostDropTargetCollisionDetection(
  (pointX, pointY) => document.elementFromPoint(pointX, pointY),
);

/**
 * Lets items be dragged between the desktop, Finder windows, the Finder sidebar and the Dock Trash.
 * A mouse drag starts after the pointer moves 4px (so clicks and double-clicks still work); a touch
 * drag starts after a short press (so scrolling still works). A preview of the item follows the
 * pointer, and dropping moves the item or puts it in the Trash.
 * @param props - The parts of the desktop that take part in dragging.
 * @param props.children - The desktop, windows and Dock.
 * @returns The drag-and-drop context.
 */
export function FileDragAndDropProvider({ children }: { children: ReactNode }): JSX.Element {
  const { fileSystem } = useDesktopSession();
  const showNotice = useDesktopNoticeStore((noticeState) => noticeState.showNotice);
  const [draggedItem, setDraggedItem] = useState<FileSystemItem>();
  const dragSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  /**
   * Shows the dragged item's preview.
   * @param dragStartEvent - The drag that started.
   */
  function showDraggedItemPreview(dragStartEvent: DragStartEvent): void {
    setDraggedItem(readDraggedItem(dragStartEvent.active.data.current));
  }

  /**
   * Moves (or trashes) the dropped item.
   * @param dragEndEvent - The finished drag.
   */
  function dropDraggedItem(dragEndEvent: DragEndEvent): void {
    setDraggedItem(undefined);
    const droppedItem = readDraggedItem(dragEndEvent.active.data.current);
    const dropDestination = readDropDestination(dragEndEvent.over?.data.current);
    if (droppedItem === undefined || dropDestination === undefined) {
      return;
    }
    performFileDrop(fileSystem, droppedItem, dropDestination).catch((dropFailure: unknown) => {
      showNotice(describeFailedAction(`move “${droppedItem.name}”`, dropFailure));
    });
  }

  return (
    <DndContext
      sensors={dragSensors}
      collisionDetection={topmostDropTargetCollisionDetection}
      onDragStart={showDraggedItemPreview}
      onDragEnd={dropDraggedItem}
      onDragCancel={() => {
        setDraggedItem(undefined);
      }}
      accessibility={{
        announcements: fileDragAnnouncements,
        screenReaderInstructions: fileDragScreenReaderInstructions,
      }}
    >
      {children}
      <DragOverlay dropAnimation={null} zIndex={2000} style={{ pointerEvents: 'none' }}>
        {draggedItem === undefined ? null : <DraggedItemPreview item={draggedItem} />}
      </DragOverlay>
    </DndContext>
  );
}

/**
 * The picture that follows the pointer while an item is dragged: its icon and name.
 * @param props - The dragged item.
 * @param props.item - The dragged item.
 * @returns The preview.
 */
function DraggedItemPreview({ item }: { item: FileSystemItem }): JSX.Element {
  return (
    <Box
      data-testid="dragged-item-preview"
      sx={{
        width: 92,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        opacity: 0.85,
        pointerEvents: 'none',
      }}
    >
      <ItemIcon iconKind={chooseItemIconKind(item)} size={56} />
      <Box
        component="span"
        sx={{
          px: 0.75,
          borderRadius: 1,
          fontSize: 12,
          color: 'primary.contrastText',
          bgcolor: 'primary.main',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.name}
      </Box>
    </Box>
  );
}
