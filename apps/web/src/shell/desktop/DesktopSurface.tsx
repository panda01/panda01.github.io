import { useCallback, useState } from 'react';
import type { JSX, MouseEvent } from 'react';
import { Box, Divider, Menu, MenuItem } from '@mui/material';
import { getInfoAppId } from '../../system/app-registry/app-registry.mts';
import {
  useDesktopSession,
  useOpenApp,
} from '../../system/desktop-session/desktop-session-context.tsx';
import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import { desktopFolderPath } from '../../system/fs/path-utilities.mts';
import { useLiveQueryResult } from '../../system/hooks/use-live-query-result.mts';
import {
  describeFailedAction,
  useDesktopNoticeStore,
} from '../../system/notices/desktop-notice-store.mts';
import {
  createUntitledFolder,
  openDesktopItem,
  openUrlInNewBrowserTab,
} from './desktop-actions.mts';
import { listDesktopMenuActions } from './desktop-menu.mts';
import type { DesktopMenuActionId } from './desktop-menu.mts';
import { DesktopIcon } from './DesktopIcon.tsx';

/** Where a right-click menu is open and what it was opened on. */
interface OpenDesktopMenu {
  position: { top: number; left: number };
  targetItem: FileSystemItem | undefined;
}

/**
 * The desktop itself: icons for everything in ~/Desktop (arranged from the top-right like macOS),
 * selection, and right-click menus for icons and for empty space. The icons update live when the
 * Desktop folder changes anywhere (another tab, Finder, or Terminal).
 * @returns The desktop surface.
 */
export function DesktopSurface(): JSX.Element {
  const { fileSystem } = useDesktopSession();
  const openApp = useOpenApp();
  const showNotice = useDesktopNoticeStore((noticeState) => noticeState.showNotice);
  const listDesktopItems = useCallback(
    () => fileSystem.listFolder(desktopFolderPath),
    [fileSystem],
  );
  const { value: desktopItems } = useLiveQueryResult<FileSystemItem[]>(listDesktopItems, []);
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const [openDesktopMenu, setOpenDesktopMenu] = useState<OpenDesktopMenu>();

  /**
   * Opens a right-click menu at the pointer.
   * @param contextMenuEvent - The right-click.
   * @param targetItem - The item right-clicked, or undefined for empty space.
   */
  function showDesktopMenu(
    contextMenuEvent: MouseEvent,
    targetItem: FileSystemItem | undefined,
  ): void {
    setOpenDesktopMenu({
      position: { top: contextMenuEvent.clientY, left: contextMenuEvent.clientX },
      targetItem,
    });
  }

  /**
   * Carries out a desktop menu action.
   * @param actionId - The chosen action.
   * @param targetItem - The item it applies to (undefined for empty-space actions).
   */
  function runDesktopMenuAction(
    actionId: DesktopMenuActionId,
    targetItem: FileSystemItem | undefined,
  ): void {
    setOpenDesktopMenu(undefined);
    if (actionId === 'new-folder') {
      createUntitledFolder(fileSystem, desktopFolderPath).catch((newFolderError: unknown) => {
        showNotice(describeFailedAction('create the folder', newFolderError));
      });
      return;
    }
    if (targetItem === undefined) {
      return;
    }
    if (actionId === 'open') {
      openDesktopItem(targetItem, openUrlInNewBrowserTab);
    } else if (actionId === 'get-info') {
      openApp(getInfoAppId, targetItem.path);
    } else {
      fileSystem.moveToTrash(targetItem.path).catch((trashError: unknown) => {
        showNotice(describeFailedAction(`move “${targetItem.name}” to the Trash`, trashError));
      });
    }
  }

  return (
    <Box
      data-testid="desktop-surface"
      onClick={() => {
        setSelectedItemId(undefined);
      }}
      onContextMenu={(contextMenuEvent) => {
        contextMenuEvent.preventDefault();
        setSelectedItemId(undefined);
        showDesktopMenu(contextMenuEvent, undefined);
      }}
      sx={{ position: 'absolute', inset: 0 }}
    >
      <Box
        component="ul"
        aria-label="Desktop items"
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
            <DesktopIcon
              item={desktopItem}
              isSelected={desktopItem.id === selectedItemId}
              onSelect={() => {
                setSelectedItemId(desktopItem.id);
              }}
              onOpen={() => {
                runDesktopMenuAction('open', desktopItem);
              }}
              onOpenContextMenu={(contextMenuEvent) => {
                showDesktopMenu(contextMenuEvent, desktopItem);
              }}
            />
          </Box>
        ))}
      </Box>
      <Menu
        open={openDesktopMenu !== undefined}
        anchorReference="anchorPosition"
        {...(openDesktopMenu === undefined ? {} : { anchorPosition: openDesktopMenu.position })}
        onClose={() => {
          setOpenDesktopMenu(undefined);
        }}
      >
        {openDesktopMenu === undefined
          ? null
          : listDesktopMenuActions(openDesktopMenu.targetItem).flatMap((desktopMenuAction) => [
              ...(desktopMenuAction.hasDividerBefore === true
                ? [<Divider key={`${desktopMenuAction.actionId}-divider`} />]
                : []),
              <MenuItem
                key={desktopMenuAction.actionId}
                disabled={desktopMenuAction.isDisabled}
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  runDesktopMenuAction(desktopMenuAction.actionId, openDesktopMenu.targetItem);
                }}
              >
                {desktopMenuAction.label}
              </MenuItem>,
            ])}
      </Menu>
    </Box>
  );
}
