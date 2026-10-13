import { useCallback, useEffect, useReducer, useState } from 'react';
import type { JSX, MouseEvent, ReactNode } from 'react';
import { Box, Button, Menu, Typography } from '@mui/material';
import type { AppWindowContentProps } from '../../system/app-registry/app-manifest.types.mts';
import { useDesktopSession } from '../../system/desktop-session/desktop-session-context.tsx';
import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import {
  getFolderDisplayName,
  homeFolderPath,
  normalizePath,
  trashFolderPath,
} from '../../system/fs/path-utilities.mts';
import { useLiveQueryResult } from '../../system/hooks/use-live-query-result.mts';
import { useMenuState } from '../../system/hooks/use-menu-state.mts';
import {
  listFolderBackgroundMenuActions,
  listItemMenuActions,
} from '../../system/item-actions/item-menu.mts';
import type {
  FolderBackgroundMenuActionId,
  ItemMenuActionId,
} from '../../system/item-actions/item-menu.mts';
import { followSelectionInQuickLook } from '../../system/item-actions/quick-look-controls.mts';
import { useItemActions } from '../../system/item-actions/use-item-actions.mts';
import { useFileDropTarget } from '../../shell/drag-and-drop/use-file-drag-and-drop.mts';
import { renderMenuEntries } from '../../shell/item-views/menu-entries.tsx';
import { listVisibleItems, searchItemsInFolder } from './finder-contents.mts';
import type { FinderViewMode } from './finder-contents.mts';
import {
  canGoBack,
  canGoForward,
  createFinderNavigationState,
  finderNavigationReducer,
  selectCurrentFolderPath,
} from './finder-navigation.mts';
import type { FinderNavigationAction } from './finder-navigation.mts';
import type { FinderItemHandlers } from './finder-view.types.mts';
import { FinderColumnView } from './FinderColumnView.tsx';
import { FinderIconView } from './FinderIconView.tsx';
import { FinderListView } from './FinderListView.tsx';
import { FinderPathBar } from './FinderPathBar.tsx';
import { FinderSidebar } from './FinderSidebar.tsx';
import { FinderToolbar } from './FinderToolbar.tsx';

const noItems: readonly FileSystemItem[] = [];

/** A right-click menu open in a Finder window: on an item, or on a folder's empty space. */
type OpenFinderMenu =
  | { kind: 'item'; position: { top: number; left: number }; targetItem: FileSystemItem }
  | {
      kind: 'background';
      position: { top: number; left: number };
      folderPath: string;
      isFolderEmpty: boolean;
    };

/**
 * Finder: browses the visitor's files. Each window keeps its own history (Back/Forward), view
 * (icons, list or columns) and selection; its title and saved location follow the folder shown,
 * so a reload reopens the same folder. Items can be opened, previewed with Space, renamed in
 * place, duplicated, downloaded, trashed, put back, and dragged between folders.
 * @param props - Window content props.
 * @param props.windowId - The window showing this Finder.
 * @param props.launchArgument - The folder to open (the home folder when omitted).
 * @returns The Finder window content.
 */
export function Finder({ windowId, launchArgument }: AppWindowContentProps): JSX.Element {
  const { fileSystem, windowManagerStore } = useDesktopSession();
  const itemActions = useItemActions();
  const [navigationState, dispatchNavigation] = useReducer(
    finderNavigationReducer,
    launchArgument ?? homeFolderPath,
    createFinderNavigationState,
  );
  const currentFolderPath = selectCurrentFolderPath(navigationState);
  const [viewMode, setViewMode] = useState<FinderViewMode>('icons');
  const [searchText, setSearchText] = useState('');
  const [selectedItemPath, setSelectedItemPath] = useState<string>();
  const [renamingItemPath, setRenamingItemPath] = useState<string>();
  const { menuContent: openMenu, isMenuOpen, showMenu, hideMenu } = useMenuState<OpenFinderMenu>();
  const trimmedSearchText = searchText.trim();
  const isSearching = trimmedSearchText !== '';
  const isShowingTrash = currentFolderPath === normalizePath(trashFolderPath);
  // Search results come from many folders, so they are always shown as a list or icons.
  const shownViewMode = isSearching && viewMode === 'columns' ? 'list' : viewMode;

  useEffect(() => {
    windowManagerStore
      .getState()
      .updateWindowTitleAndLaunchArgument(
        windowId,
        getFolderDisplayName(currentFolderPath),
        currentFolderPath,
      );
  }, [windowId, windowManagerStore, currentFolderPath]);

  const listShownItems = useCallback(async () => {
    if (isSearching) {
      return searchItemsInFolder(
        await fileSystem.listAllItems(),
        currentFolderPath,
        trimmedSearchText,
      );
    }
    return listVisibleItems(await fileSystem.listFolder(currentFolderPath));
  }, [fileSystem, currentFolderPath, isSearching, trimmedSearchText]);
  const { value: shownItems, error: folderError } = useLiveQueryResult<readonly FileSystemItem[]>(
    listShownItems,
    noItems,
  );

  /**
   * Moves through the window's history, clearing the selection, renaming and search.
   * @param navigationAction - Where to go.
   */
  function navigate(navigationAction: FinderNavigationAction): void {
    dispatchNavigation(navigationAction);
    setSelectedItemPath(undefined);
    setRenamingItemPath(undefined);
    setSearchText('');
  }

  /**
   * Shows a folder in this window.
   * @param folderPath - The folder to show.
   */
  function showFolder(folderPath: string): void {
    navigate({ type: 'show-folder', folderPath });
  }

  /**
   * Selects an item; an open Quick Look window follows the selection.
   * @param itemPath - The item to select.
   */
  function selectItem(itemPath: string): void {
    setSelectedItemPath(itemPath);
    followSelectionInQuickLook(windowManagerStore, itemPath);
  }

  /**
   * Opens the name field for an item.
   * @param itemPath - The item to rename.
   */
  function startRenamingItem(itemPath: string): void {
    setSelectedItemPath(itemPath);
    setRenamingItemPath(itemPath);
  }

  /**
   * Builds what one item does when clicked, opened, previewed, right-clicked or renamed.
   * @param item - The item.
   * @returns Its handlers.
   */
  function buildItemHandlers(item: FileSystemItem): FinderItemHandlers {
    return {
      /**
       * Selects the item.
       */
      onSelect: () => {
        selectItem(item.path);
      },
      /**
       * Opens the item; folders open in this window.
       */
      onOpen: () => {
        itemActions.openItem(item, { showFolderInPlace: showFolder });
      },
      /**
       * Toggles Quick Look on the item.
       */
      onToggleQuickLook: () => {
        itemActions.toggleQuickLook(item.path);
      },
      /**
       * Opens the item's menu at the pointer.
       * @param contextMenuEvent - The right-click.
       */
      onOpenContextMenu: (contextMenuEvent) => {
        showMenu({
          kind: 'item',
          position: { top: contextMenuEvent.clientY, left: contextMenuEvent.clientX },
          targetItem: item,
        });
      },
      onSelectNeighbor: selectItem,
      /**
       * Ends renaming, keeping the new name unless it was cancelled.
       * @param requestedName - The typed name, or undefined when cancelled.
       */
      onFinishRenaming: (requestedName) => {
        setRenamingItemPath(undefined);
        if (requestedName === undefined) {
          return;
        }
        void itemActions.renameItem(item, requestedName).then((renamedItem) => {
          if (renamedItem !== undefined) {
            setSelectedItemPath(renamedItem.path);
          }
        });
      },
    };
  }

  /**
   * Handles a click in column view: a folder opens as the next column; anything else is selected
   * (showing its column's folder first when it is in an earlier column).
   * @param item - The clicked item.
   * @param columnFolderPath - The folder of the column it is in.
   */
  function selectItemInColumn(item: FileSystemItem, columnFolderPath: string): void {
    if (item.kind === 'folder') {
      showFolder(item.path);
      return;
    }
    if (normalizePath(columnFolderPath) !== currentFolderPath) {
      showFolder(columnFolderPath);
    }
    selectItem(item.path);
  }

  /**
   * Opens the empty-space menu for a folder.
   * @param contextMenuEvent - The right-click.
   * @param folderPath - The folder whose empty space was right-clicked.
   * @param isFolderEmpty - Whether the folder has no items.
   */
  function openBackgroundMenu(
    contextMenuEvent: MouseEvent<HTMLElement>,
    folderPath: string,
    isFolderEmpty: boolean,
  ): void {
    showMenu({
      kind: 'background',
      position: { top: contextMenuEvent.clientY, left: contextMenuEvent.clientX },
      folderPath,
      isFolderEmpty,
    });
  }

  /**
   * Carries out an entry of an item's menu.
   * @param actionId - The chosen entry.
   * @param targetItem - The item.
   */
  function runItemMenuAction(actionId: ItemMenuActionId, targetItem: FileSystemItem): void {
    hideMenu();
    itemActions.runItemMenuAction(actionId, targetItem, {
      showFolderInPlace: showFolder,
      startRenamingItem,
    });
  }

  /**
   * Carries out an entry of the empty-space menu.
   * @param actionId - The chosen entry.
   * @param folderPath - The folder it applies to.
   */
  function runBackgroundMenuAction(
    actionId: FolderBackgroundMenuActionId,
    folderPath: string,
  ): void {
    hideMenu();
    if (actionId === 'empty-trash') {
      itemActions.emptyTrash();
      return;
    }
    void itemActions.createFolderIn(folderPath).then((newFolder) => {
      if (newFolder !== undefined) {
        startRenamingItem(newFolder.path);
      }
    });
  }

  const itemViewProps = {
    windowId,
    items: shownItems,
    selectedItemPath,
    renamingItemPath,
    buildItemHandlers,
  };
  let folderView: ReactNode;
  if (folderError !== undefined) {
    folderView = (
      <Typography role="status" sx={{ p: 3, color: 'text.secondary' }}>
        This folder is no longer available.
      </Typography>
    );
  } else if (shownViewMode === 'columns') {
    folderView = (
      <FinderColumnView
        windowId={windowId}
        currentFolderPath={currentFolderPath}
        selectedItemPath={selectedItemPath}
        renamingItemPath={renamingItemPath}
        buildItemHandlers={buildItemHandlers}
        onSelectInColumn={selectItemInColumn}
        onOpenColumnMenu={openBackgroundMenu}
      />
    );
  } else {
    folderView = (
      <FinderFolderBackground
        windowId={windowId}
        folderPath={currentFolderPath}
        onClearSelection={() => {
          setSelectedItemPath(undefined);
        }}
        onOpenBackgroundMenu={(contextMenuEvent) => {
          openBackgroundMenu(contextMenuEvent, currentFolderPath, shownItems.length === 0);
        }}
      >
        {isSearching && shownItems.length === 0 ? (
          <Typography role="status" sx={{ p: 3, color: 'text.secondary' }}>
            No results
          </Typography>
        ) : null}
        {shownViewMode === 'list' ? (
          <FinderListView {...itemViewProps} />
        ) : (
          <FinderIconView {...itemViewProps} />
        )}
      </FinderFolderBackground>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <FinderToolbar
        canGoBack={canGoBack(navigationState)}
        canGoForward={canGoForward(navigationState)}
        onGoBack={() => {
          navigate({ type: 'go-back' });
        }}
        onGoForward={() => {
          navigate({ type: 'go-forward' });
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchText={searchText}
        onSearchTextChange={setSearchText}
      />
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <FinderSidebar
          windowId={windowId}
          currentFolderPath={currentFolderPath}
          onShowFolder={showFolder}
        />
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {isShowingTrash ? (
            <FinderTrashBanner
              isTrashEmpty={shownItems.length === 0 && !isSearching}
              onEmptyTrash={itemActions.emptyTrash}
            />
          ) : null}
          {folderView}
          <FinderPathBar
            currentFolderPath={currentFolderPath}
            itemCount={shownItems.length}
            onShowFolder={showFolder}
          />
        </Box>
      </Box>
      <FinderContextMenu
        openMenu={openMenu}
        isMenuOpen={isMenuOpen}
        onClose={hideMenu}
        onRunItemMenuAction={runItemMenuAction}
        onRunBackgroundMenuAction={runBackgroundMenuAction}
      />
    </Box>
  );
}

/**
 * The empty space behind a folder's items in icon and list view: clicking it clears the selection,
 * right-clicking it opens the folder's menu, and items dropped on it move into the folder.
 * @param props - The window, folder, handlers and the view inside.
 * @param props.windowId - The Finder window.
 * @param props.folderPath - The folder shown.
 * @param props.onClearSelection - Clears the selection.
 * @param props.onOpenBackgroundMenu - Opens the folder's menu.
 * @param props.children - The folder view.
 * @returns The background.
 */
function FinderFolderBackground({
  windowId,
  folderPath,
  onClearSelection,
  onOpenBackgroundMenu,
  children,
}: {
  windowId: string;
  folderPath: string;
  onClearSelection: () => void;
  onOpenBackgroundMenu: (contextMenuEvent: MouseEvent<HTMLElement>) => void;
  children: ReactNode;
}): JSX.Element {
  const { setDropNodeRef, dropTargetAttributes, isDropHighlighted } = useFileDropTarget(
    `${windowId}:background`,
    { kind: 'folder', folderPath },
  );
  return (
    <Box
      ref={setDropNodeRef}
      {...dropTargetAttributes}
      onClick={onClearSelection}
      onContextMenu={(contextMenuEvent: MouseEvent<HTMLElement>) => {
        contextMenuEvent.preventDefault();
        onOpenBackgroundMenu(contextMenuEvent);
      }}
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        outline: isDropHighlighted ? '2px solid' : 'none',
        outlineOffset: -2,
        outlineColor: 'primary.main',
      }}
    >
      {children}
    </Box>
  );
}

/**
 * The bar shown at the top of the Trash, with its Empty button.
 * @param props - Whether the Trash is empty, and the handler.
 * @param props.isTrashEmpty - Whether there is nothing to empty.
 * @param props.onEmptyTrash - Empties the Trash.
 * @returns The bar.
 */
function FinderTrashBanner({
  isTrashEmpty,
  onEmptyTrash,
}: {
  isTrashEmpty: boolean;
  onEmptyTrash: () => void;
}): JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.5,
        flexShrink: 0,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'action.hover',
      }}
    >
      <Typography sx={{ flex: 1, fontSize: 12, fontWeight: 600 }}>Trash</Typography>
      <Button size="small" variant="outlined" disabled={isTrashEmpty} onClick={onEmptyTrash}>
        Empty
      </Button>
    </Box>
  );
}

/**
 * Finder's right-click menu, for an item or for a folder's empty space.
 * @param props - The open menu and the action handlers.
 * @param props.openMenu - What the menu shows (kept while it fades out after closing).
 * @param props.isMenuOpen - Whether the menu is open.
 * @param props.onClose - Closes the menu.
 * @param props.onRunItemMenuAction - Runs an item menu entry.
 * @param props.onRunBackgroundMenuAction - Runs an empty-space menu entry.
 * @returns The menu.
 */
function FinderContextMenu({
  openMenu,
  isMenuOpen,
  onClose,
  onRunItemMenuAction,
  onRunBackgroundMenuAction,
}: {
  openMenu: OpenFinderMenu | undefined;
  isMenuOpen: boolean;
  onClose: () => void;
  onRunItemMenuAction: (actionId: ItemMenuActionId, targetItem: FileSystemItem) => void;
  onRunBackgroundMenuAction: (actionId: FolderBackgroundMenuActionId, folderPath: string) => void;
}): JSX.Element {
  let menuEntries: ReactNode[] = [];
  if (openMenu?.kind === 'item') {
    menuEntries = renderMenuEntries(listItemMenuActions(openMenu.targetItem), (actionId) => {
      onRunItemMenuAction(actionId, openMenu.targetItem);
    });
  } else if (openMenu?.kind === 'background') {
    menuEntries = renderMenuEntries(
      listFolderBackgroundMenuActions(openMenu.folderPath, openMenu.isFolderEmpty),
      (actionId) => {
        onRunBackgroundMenuAction(actionId, openMenu.folderPath);
      },
    );
  }
  return (
    <Menu
      open={isMenuOpen && openMenu !== undefined}
      anchorReference="anchorPosition"
      {...(openMenu === undefined ? {} : { anchorPosition: openMenu.position })}
      onClose={onClose}
    >
      {menuEntries}
    </Menu>
  );
}
