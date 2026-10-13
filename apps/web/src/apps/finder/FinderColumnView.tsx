import { useCallback, useEffect, useRef } from 'react';
import type { JSX, MouseEvent } from 'react';
import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useDesktopSession } from '../../system/desktop-session/desktop-session-context.tsx';
import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import {
  chooseItemIconKind,
  computeRenameSelectionLength,
  describeItemKind,
  formatByteSize,
} from '../../system/fs/item-presentation.mts';
import { getFolderDisplayName } from '../../system/fs/path-utilities.mts';
import { useLiveQueryResult } from '../../system/hooks/use-live-query-result.mts';
import { findItemDropDestination } from '../../shell/drag-and-drop/file-drag-and-drop.mts';
import { useFileDropTarget } from '../../shell/drag-and-drop/use-file-drag-and-drop.mts';
import { ItemIcon } from '../../shell/icons/item-icons.tsx';
import { InlineRenameField } from '../../shell/item-views/InlineRenameField.tsx';
import { itemViewMarker } from '../../shell/item-views/item-view-navigation.mts';
import { useFileItemInteractions } from '../../shell/item-views/use-file-item-interactions.mts';
import { listColumnFolderPaths, listVisibleItems } from './finder-contents.mts';
import type { FinderItemHandlers } from './finder-view.types.mts';

const noItems: readonly FileSystemItem[] = [];

/** Props for Finder's column view. */
export interface FinderColumnViewProps {
  windowId: string;
  currentFolderPath: string;
  selectedItemPath: string | undefined;
  renamingItemPath: string | undefined;
  /** Builds an item's handlers; selecting is replaced by `onSelectInColumn`. */
  buildItemHandlers: (item: FileSystemItem) => FinderItemHandlers;
  /** Clicking an item in a column: folders open as the next column, files are selected. */
  onSelectInColumn: (item: FileSystemItem, columnFolderPath: string) => void;
  /** Right-clicking a column's empty space. */
  onOpenColumnMenu: (
    contextMenuEvent: MouseEvent<HTMLElement>,
    columnFolderPath: string,
    isColumnEmpty: boolean,
  ) => void;
}

/**
 * Finder's column view: the folders leading to the current folder side by side, each listing its
 * items, plus a preview of the selected file. It scrolls to show the newest column.
 * @param props - The window, folder, selection, renaming state and handlers.
 * @param props.windowId - The Finder window.
 * @param props.currentFolderPath - The folder shown (the last column).
 * @param props.selectedItemPath - The selected item, if any.
 * @param props.renamingItemPath - The item being renamed, if any.
 * @param props.buildItemHandlers - Builds each item's handlers.
 * @param props.onSelectInColumn - Handles clicks on items.
 * @param props.onOpenColumnMenu - Opens a column's right-click menu.
 * @returns The columns.
 */
export function FinderColumnView({
  windowId,
  currentFolderPath,
  selectedItemPath,
  renamingItemPath,
  buildItemHandlers,
  onSelectInColumn,
  onOpenColumnMenu,
}: FinderColumnViewProps): JSX.Element {
  const columnFolderPaths = listColumnFolderPaths(currentFolderPath);
  const columnsContainerRef = useRef<HTMLDivElement>(null);
  const shownColumnsKey = `${columnFolderPaths.join('|')}|${selectedItemPath ?? ''}`;
  const scrollToNewestColumn = useCallback(() => {
    const columnsContainer = columnsContainerRef.current;
    if (columnsContainer !== null) {
      columnsContainer.scrollLeft = columnsContainer.scrollWidth;
    }
  }, []);

  // Like Finder, keep the newest column in view when the columns change (and the preview once it
  // has loaded, below).
  useEffect(() => {
    scrollToNewestColumn();
  }, [shownColumnsKey, scrollToNewestColumn]);

  return (
    <Box
      ref={columnsContainerRef}
      sx={{ flex: 1, minHeight: 0, display: 'flex', overflowX: 'auto' }}
    >
      {columnFolderPaths.map((columnFolderPath, columnIndex) => (
        <FinderColumn
          key={columnFolderPath}
          windowId={windowId}
          columnFolderPath={columnFolderPath}
          highlightedItemPath={columnFolderPaths[columnIndex + 1] ?? selectedItemPath}
          renamingItemPath={renamingItemPath}
          buildItemHandlers={buildItemHandlers}
          onSelectInColumn={onSelectInColumn}
          onOpenColumnMenu={onOpenColumnMenu}
        />
      ))}
      {selectedItemPath === undefined ? null : (
        <FinderColumnPreview
          selectedItemPath={selectedItemPath}
          onPreviewShown={scrollToNewestColumn}
        />
      )}
    </Box>
  );
}

/**
 * One column: a folder's items. Its empty space accepts dropped items.
 * @param props - The column's folder, highlighted item and handlers.
 * @param props.windowId - The Finder window.
 * @param props.columnFolderPath - The folder listed.
 * @param props.highlightedItemPath - The item highlighted in this column (the next column's
 *   folder, or the selection).
 * @param props.renamingItemPath - The item being renamed, if any.
 * @param props.buildItemHandlers - Builds each item's handlers.
 * @param props.onSelectInColumn - Handles clicks on items.
 * @param props.onOpenColumnMenu - Opens the column's right-click menu.
 * @returns The column.
 */
function FinderColumn({
  windowId,
  columnFolderPath,
  highlightedItemPath,
  renamingItemPath,
  buildItemHandlers,
  onSelectInColumn,
  onOpenColumnMenu,
}: Omit<FinderColumnViewProps, 'currentFolderPath' | 'selectedItemPath'> & {
  columnFolderPath: string;
  highlightedItemPath: string | undefined;
}): JSX.Element {
  const { fileSystem } = useDesktopSession();
  const listColumnItems = useCallback(
    async () => listVisibleItems(await fileSystem.listFolder(columnFolderPath)),
    [fileSystem, columnFolderPath],
  );
  const { value: columnItems } = useLiveQueryResult<readonly FileSystemItem[]>(
    listColumnItems,
    noItems,
  );
  const { setDropNodeRef, dropTargetAttributes, isDropHighlighted } = useFileDropTarget(
    `${windowId}:column`,
    { kind: 'folder', folderPath: columnFolderPath },
  );

  return (
    <Box
      ref={setDropNodeRef}
      component="ul"
      aria-label={getFolderDisplayName(columnFolderPath)}
      {...itemViewMarker}
      {...dropTargetAttributes}
      onContextMenu={(contextMenuEvent: MouseEvent<HTMLElement>) => {
        contextMenuEvent.preventDefault();
        onOpenColumnMenu(contextMenuEvent, columnFolderPath, columnItems.length === 0);
      }}
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0.5,
        width: 210,
        flexShrink: 0,
        overflowY: 'auto',
        borderRight: '1px solid',
        borderColor: 'divider',
        bgcolor: isDropHighlighted ? 'action.hover' : 'transparent',
      }}
    >
      {columnItems.map((columnItem) => (
        <Box component="li" key={columnItem.id}>
          <FinderColumnEntry
            item={columnItem}
            placeId={windowId}
            isHighlighted={columnItem.path === highlightedItemPath}
            isRenaming={columnItem.path === renamingItemPath}
            {...buildItemHandlers(columnItem)}
            onSelect={() => {
              onSelectInColumn(columnItem, columnFolderPath);
            }}
          />
        </Box>
      ))}
    </Box>
  );
}

/**
 * One item in a column: a small icon, its name, and an arrow for folders.
 * @param props - The item, its state and handlers.
 * @param props.item - The item.
 * @param props.placeId - Where it is shown.
 * @param props.isHighlighted - Whether it is highlighted.
 * @param props.isRenaming - Whether its name field is open.
 * @param props.onFinishRenaming - Receives the new name.
 * @returns The entry.
 */
function FinderColumnEntry({
  item,
  placeId,
  isHighlighted,
  isRenaming,
  onFinishRenaming,
  ...interactionHandlers
}: FinderItemHandlers & {
  item: FileSystemItem;
  placeId: string;
  isHighlighted: boolean;
  isRenaming: boolean;
}): JSX.Element {
  const {
    dragListeners,
    dropTargetAttributes,
    itemElementProps,
    isBeingDragged,
    isDropHighlighted,
  } = useFileItemInteractions(item, placeId, isRenaming, interactionHandlers);
  const entryLayout = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 1,
    px: 1,
    py: 0.25,
    borderRadius: 1,
    fontSize: 13,
  } as const;

  if (isRenaming) {
    return (
      <Box sx={entryLayout}>
        <ItemIcon iconKind={chooseItemIconKind(item)} size={18} />
        <InlineRenameField
          initialName={item.name}
          selectedCharacterCount={computeRenameSelectionLength(item)}
          onFinish={onFinishRenaming}
        />
      </Box>
    );
  }

  const opensAsColumn = findItemDropDestination(item) !== undefined;
  return (
    <ButtonBase
      aria-label={item.name}
      {...dragListeners}
      {...dropTargetAttributes}
      {...itemElementProps}
      sx={{
        ...entryLayout,
        opacity: isBeingDragged ? 0.4 : 1,
        color: isHighlighted ? 'primary.contrastText' : 'text.primary',
        bgcolor: isHighlighted ? 'primary.main' : 'transparent',
        outline: isDropHighlighted ? '2px solid' : 'none',
        outlineColor: 'primary.main',
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
      }}
    >
      <ItemIcon iconKind={chooseItemIconKind(item)} size={18} />
      <Box
        component="span"
        sx={{
          flex: 1,
          textAlign: 'left',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.name}
      </Box>
      {opensAsColumn ? <ChevronRightIcon fontSize="small" sx={{ opacity: 0.6 }} /> : null}
    </ButtonBase>
  );
}

/**
 * The last column's preview of the selected file: a big icon, its name, kind and size.
 * @param props - The selected item's path, and what to do once the preview is shown.
 * @param props.selectedItemPath - The selected item.
 * @param props.onPreviewShown - Called when the preview appears (to scroll it into view).
 * @returns The preview, or nothing for folders (they open as a column instead).
 */
function FinderColumnPreview({
  selectedItemPath,
  onPreviewShown,
}: {
  selectedItemPath: string;
  onPreviewShown: () => void;
}): JSX.Element | null {
  const { fileSystem } = useDesktopSession();
  const findSelectedItem = useCallback(
    () => fileSystem.findItem(selectedItemPath),
    [fileSystem, selectedItemPath],
  );
  const { value: selectedItem } = useLiveQueryResult<FileSystemItem | undefined>(
    findSelectedItem,
    undefined,
  );
  const isPreviewShown = selectedItem !== undefined && selectedItem.kind !== 'folder';

  useEffect(() => {
    if (isPreviewShown) {
      onPreviewShown();
    }
  }, [isPreviewShown, onPreviewShown]);

  if (selectedItem === undefined || selectedItem.kind === 'folder') {
    return null;
  }
  return (
    <Stack spacing={1} sx={{ alignItems: 'center', p: 3, minWidth: 220, textAlign: 'center' }}>
      <ItemIcon iconKind={chooseItemIconKind(selectedItem)} size={96} />
      <Typography sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{selectedItem.name}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {describeItemKind(selectedItem)}
        {selectedItem.kind === 'file' ? ` – ${formatByteSize(selectedItem.sizeInBytes)}` : ''}
      </Typography>
    </Stack>
  );
}
