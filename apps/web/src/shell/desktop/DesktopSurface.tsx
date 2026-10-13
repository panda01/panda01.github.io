import { useCallback, useState } from 'react';
import type { JSX, MouseEvent, ReactNode } from 'react';
import { Box, Menu } from '@mui/material';
import { useDesktopSession } from '../../system/desktop-session/desktop-session-context.tsx';
import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import { desktopFolderPath, isHiddenItemName } from '../../system/fs/path-utilities.mts';
import { useLiveQueryResult } from '../../system/hooks/use-live-query-result.mts';
import { useMenuState } from '../../system/hooks/use-menu-state.mts';
import {
  listFolderBackgroundMenuActions,
  listItemMenuActions,
} from '../../system/item-actions/item-menu.mts';
import { followSelectionInQuickLook } from '../../system/item-actions/quick-look-controls.mts';
import { useItemActions } from '../../system/item-actions/use-item-actions.mts';
import { useFileDropTarget } from '../drag-and-drop/use-file-drag-and-drop.mts';
import { FileItemTile } from '../item-views/FileItemTile.tsx';
import { itemViewMarker } from '../item-views/item-view-navigation.mts';
import { renderMenuEntries } from '../item-views/menu-entries.tsx';

const noItems: readonly FileSystemItem[] = [];

/** Id the desktop uses for its items in drag-and-drop. */
export const desktopPlaceId = 'desktop';

/** Where a right-click menu is open and what it was opened on. */
interface OpenDesktopMenu {
  position: { top: number; left: number };
  targetItem: FileSystemItem | undefined;
}

/**
 * The desktop itself: icons for everything in ~/Desktop (arranged from the top-right like macOS)
 * that behave like Finder's: click selects, double-click or Enter opens (folders in Finder, files
 * in Quick Look, links in a new tab), Space toggles Quick Look, icons can be renamed in place and
 * dragged into folders, Finder windows or the Trash, and items dropped on empty desktop space move
 * to the Desktop folder. The icons update live when the Desktop folder changes anywhere (another
 * tab, Finder, or Terminal).
 * @returns The desktop surface.
 */
export function DesktopSurface(): JSX.Element {
  const { fileSystem, windowManagerStore } = useDesktopSession();
  const itemActions = useItemActions();
  const listDesktopItems = useCallback(async () => {
    const desktopFolderItems = await fileSystem.listFolder(desktopFolderPath);
    return desktopFolderItems.filter((desktopItem) => !isHiddenItemName(desktopItem.name));
  }, [fileSystem]);
  const { value: desktopItems } = useLiveQueryResult<readonly FileSystemItem[]>(
    listDesktopItems,
    noItems,
  );
  const [selectedItemPath, setSelectedItemPath] = useState<string>();
  const [renamingItemPath, setRenamingItemPath] = useState<string>();
  const {
    menuContent: openDesktopMenu,
    isMenuOpen: isDesktopMenuOpen,
    showMenu: showDesktopMenuContent,
    hideMenu: hideDesktopMenu,
  } = useMenuState<OpenDesktopMenu>();
  const { setDropNodeRef, dropTargetAttributes } = useFileDropTarget(
    `${desktopPlaceId}:background`,
    {
      kind: 'folder',
      folderPath: desktopFolderPath,
    },
  );

  /**
   * Selects an icon; an open Quick Look window follows the selection.
   * @param itemPath - The icon's item.
   */
  function selectItem(itemPath: string): void {
    setSelectedItemPath(itemPath);
    followSelectionInQuickLook(windowManagerStore, itemPath);
  }

  /**
   * Opens a right-click menu at the pointer.
   * @param contextMenuEvent - The right-click.
   * @param targetItem - The item right-clicked, or undefined for empty space.
   */
  function showDesktopMenu(
    contextMenuEvent: MouseEvent<HTMLElement>,
    targetItem: FileSystemItem | undefined,
  ): void {
    showDesktopMenuContent({
      position: { top: contextMenuEvent.clientY, left: contextMenuEvent.clientX },
      targetItem,
    });
  }

  /**
   * Ends renaming an icon, keeping the new name unless it was cancelled.
   * @param item - The renamed item.
   * @param requestedName - The typed name, or undefined when cancelled.
   */
  function finishRenaming(item: FileSystemItem, requestedName: string | undefined): void {
    setRenamingItemPath(undefined);
    if (requestedName === undefined) {
      return;
    }
    void itemActions.renameItem(item, requestedName).then((renamedItem) => {
      if (renamedItem !== undefined) {
        setSelectedItemPath(renamedItem.path);
      }
    });
  }

  let menuEntries: ReactNode[] = [];
  if (openDesktopMenu !== undefined) {
    const { targetItem } = openDesktopMenu;
    menuEntries =
      targetItem === undefined
        ? renderMenuEntries(
            listFolderBackgroundMenuActions(desktopFolderPath, desktopItems.length === 0),
            () => {
              hideDesktopMenu();
              void itemActions.createFolderIn(desktopFolderPath);
            },
          )
        : renderMenuEntries(listItemMenuActions(targetItem), (actionId) => {
            hideDesktopMenu();
            itemActions.runItemMenuAction(actionId, targetItem, {
              /**
               * Opens the icon's name field.
               * @param itemPath - The item to rename.
               */
              startRenamingItem: (itemPath) => {
                setSelectedItemPath(itemPath);
                setRenamingItemPath(itemPath);
              },
            });
          });
  }

  return (
    <Box
      ref={setDropNodeRef}
      {...dropTargetAttributes}
      data-testid="desktop-surface"
      onClick={() => {
        setSelectedItemPath(undefined);
      }}
      onContextMenu={(contextMenuEvent: MouseEvent<HTMLElement>) => {
        contextMenuEvent.preventDefault();
        setSelectedItemPath(undefined);
        showDesktopMenu(contextMenuEvent, undefined);
      }}
      sx={{ position: 'absolute', inset: 0 }}
    >
      <Box
        component="ul"
        aria-label="Desktop items"
        {...itemViewMarker}
        sx={{
          listStyle: 'none',
          m: 0,
          p: 1.5,
          pb: 13,
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          flexWrap: 'wrap-reverse',
          alignContent: 'flex-start',
          gap: 1,
        }}
      >
        {desktopItems.map((desktopItem) => (
          <Box component="li" key={desktopItem.id}>
            <FileItemTile
              item={desktopItem}
              placeId={desktopPlaceId}
              appearance="on-wallpaper"
              isSelected={desktopItem.path === selectedItemPath}
              isRenaming={desktopItem.path === renamingItemPath}
              onSelect={() => {
                selectItem(desktopItem.path);
              }}
              onOpen={() => {
                itemActions.openItem(desktopItem);
              }}
              onToggleQuickLook={() => {
                itemActions.toggleQuickLook(desktopItem.path);
              }}
              onOpenContextMenu={(contextMenuEvent) => {
                showDesktopMenu(contextMenuEvent, desktopItem);
              }}
              onSelectNeighbor={selectItem}
              onFinishRenaming={(requestedName) => {
                finishRenaming(desktopItem, requestedName);
              }}
            />
          </Box>
        ))}
      </Box>
      <Menu
        open={isDesktopMenuOpen && openDesktopMenu !== undefined}
        anchorReference="anchorPosition"
        {...(openDesktopMenu === undefined ? {} : { anchorPosition: openDesktopMenu.position })}
        onClose={() => {
          hideDesktopMenu();
        }}
      >
        {menuEntries}
      </Menu>
    </Box>
  );
}
