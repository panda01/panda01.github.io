import type { JSX } from 'react';
import { Box } from '@mui/material';
import { FileItemTile } from '../../shell/item-views/FileItemTile.tsx';
import { itemViewMarker } from '../../shell/item-views/item-view-navigation.mts';
import type { FinderItemViewProps } from './finder-view.types.mts';

/**
 * Finder's icon view: the folder's items as big icons in a grid.
 * @param props - The window, items, selection, renaming state and item handlers.
 * @param props.windowId - The Finder window.
 * @param props.items - The items to show.
 * @param props.selectedItemPath - The selected item, if any.
 * @param props.renamingItemPath - The item being renamed, if any.
 * @param props.buildItemHandlers - Builds each item's handlers.
 * @returns The icon grid.
 */
export function FinderIconView({
  windowId,
  items,
  selectedItemPath,
  renamingItemPath,
  buildItemHandlers,
}: FinderItemViewProps): JSX.Element {
  return (
    <Box
      component="ul"
      aria-label="Folder contents"
      {...itemViewMarker}
      sx={{
        listStyle: 'none',
        m: 0,
        p: 1.5,
        minHeight: '100%',
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
        alignContent: 'start',
        justifyItems: 'center',
        gap: 1,
      }}
    >
      {items.map((item) => (
        <Box component="li" key={item.id}>
          <FileItemTile
            item={item}
            placeId={windowId}
            appearance="in-window"
            isSelected={item.path === selectedItemPath}
            isRenaming={item.path === renamingItemPath}
            {...buildItemHandlers(item)}
          />
        </Box>
      ))}
    </Box>
  );
}
