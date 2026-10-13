import { useState } from 'react';
import type { JSX } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
} from '@mui/material';
import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import {
  chooseItemIconKind,
  computeRenameSelectionLength,
  describeItemKind,
  formatByteSize,
  formatItemTimestampCompactly,
} from '../../system/fs/item-presentation.mts';
import { ItemIcon } from '../../shell/icons/item-icons.tsx';
import { InlineRenameField } from '../../shell/item-views/InlineRenameField.tsx';
import { itemViewMarker } from '../../shell/item-views/item-view-navigation.mts';
import { useFileItemInteractions } from '../../shell/item-views/use-file-item-interactions.mts';
import { defaultFinderSortOrder, sortItemsForListView } from './finder-contents.mts';
import type { FinderSortColumn, FinderSortOrder } from './finder-contents.mts';
import type { FinderItemHandlers, FinderItemViewProps } from './finder-view.types.mts';

/** List view's columns, left to right. */
const listViewColumns: readonly { column: FinderSortColumn; heading: string }[] = [
  { column: 'name', heading: 'Name' },
  { column: 'modified', heading: 'Date Modified' },
  { column: 'size', heading: 'Size' },
  { column: 'kind', heading: 'Kind' },
];

/**
 * Works out the new sort order after a column heading is clicked: the same column flips direction,
 * another column sorts ascending.
 * @param currentSortOrder - The current order.
 * @param clickedColumn - The clicked column.
 * @returns The new order.
 */
export function toggleSortOrder(
  currentSortOrder: FinderSortOrder,
  clickedColumn: FinderSortColumn,
): FinderSortOrder {
  if (currentSortOrder.column !== clickedColumn) {
    return { column: clickedColumn, direction: 'ascending' };
  }
  return {
    column: clickedColumn,
    direction: currentSortOrder.direction === 'ascending' ? 'descending' : 'ascending',
  };
}

/**
 * Finder's list view: one row per item with its date, size and kind; click a heading to sort.
 * @param props - The window, items, selection, renaming state and item handlers.
 * @param props.windowId - The Finder window.
 * @param props.items - The items to show.
 * @param props.selectedItemPath - The selected item, if any.
 * @param props.renamingItemPath - The item being renamed, if any.
 * @param props.buildItemHandlers - Builds each item's handlers.
 * @returns The table.
 */
export function FinderListView({
  windowId,
  items,
  selectedItemPath,
  renamingItemPath,
  buildItemHandlers,
}: FinderItemViewProps): JSX.Element {
  const [sortOrder, setSortOrder] = useState<FinderSortOrder>(defaultFinderSortOrder);
  return (
    <Table
      size="small"
      stickyHeader
      aria-label="Folder contents"
      {...itemViewMarker}
      sx={{ '& .MuiTableCell-root': { fontSize: 12, py: 0.5, borderBottom: 'none' } }}
    >
      <TableHead>
        <TableRow>
          {listViewColumns.map(({ column, heading }) => {
            const isSortedByColumn = sortOrder.column === column;
            const sortDirection = sortOrder.direction === 'ascending' ? 'asc' : 'desc';
            return (
              <TableCell
                key={column}
                sortDirection={isSortedByColumn ? sortDirection : false}
                sx={{ fontWeight: 600, bgcolor: 'background.paper' }}
              >
                <TableSortLabel
                  active={isSortedByColumn}
                  direction={isSortedByColumn ? sortDirection : 'asc'}
                  onClick={() => {
                    setSortOrder(toggleSortOrder(sortOrder, column));
                  }}
                >
                  {heading}
                </TableSortLabel>
              </TableCell>
            );
          })}
        </TableRow>
      </TableHead>
      <TableBody>
        {sortItemsForListView(items, sortOrder).map((item) => (
          <FinderListRow
            key={item.id}
            item={item}
            placeId={windowId}
            isSelected={item.path === selectedItemPath}
            isRenaming={item.path === renamingItemPath}
            {...buildItemHandlers(item)}
          />
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * One row of list view.
 * @param props - The item, its state and handlers.
 * @param props.item - The item.
 * @param props.placeId - Where it is shown.
 * @param props.isSelected - Whether it is selected.
 * @param props.isRenaming - Whether its name field is open.
 * @param props.onFinishRenaming - Receives the new name.
 * @returns The row.
 */
function FinderListRow({
  item,
  placeId,
  isSelected,
  isRenaming,
  onFinishRenaming,
  ...interactionHandlers
}: FinderItemHandlers & {
  item: FileSystemItem;
  placeId: string;
  isSelected: boolean;
  isRenaming: boolean;
}): JSX.Element {
  const {
    dragListeners,
    dropTargetAttributes,
    itemElementProps,
    isBeingDragged,
    isDropHighlighted,
  } = useFileItemInteractions(item, placeId, isRenaming, interactionHandlers);
  return (
    <TableRow
      tabIndex={isRenaming ? -1 : 0}
      selected={isSelected || isDropHighlighted}
      {...dragListeners}
      {...dropTargetAttributes}
      {...itemElementProps}
      sx={{
        opacity: isBeingDragged ? 0.4 : 1,
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
        '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'action.selected' },
      }}
    >
      <TableCell sx={{ width: '45%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <ItemIcon iconKind={chooseItemIconKind(item)} size={18} />
          {isRenaming ? (
            <InlineRenameField
              initialName={item.name}
              selectedCharacterCount={computeRenameSelectionLength(item)}
              onFinish={onFinishRenaming}
            />
          ) : (
            <Box
              component="span"
              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {item.name}
            </Box>
          )}
        </Box>
      </TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        {formatItemTimestampCompactly(item.modifiedAt)}
      </TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        {item.kind === 'file' ? formatByteSize(item.sizeInBytes) : '--'}
      </TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{describeItemKind(item)}</TableCell>
    </TableRow>
  );
}
