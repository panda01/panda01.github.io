import { Fragment, useCallback, useRef, useState } from 'react';
import type { JSX, MouseEvent } from 'react';
import { Box, Divider, Menu, MenuItem } from '@mui/material';
import { useMotionValue } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { appManifests, findAppManifest } from '../../system/app-registry/app-registry.mts';
import {
  useDesktopSession,
  useOpenApp,
  useWindowManager,
} from '../../system/desktop-session/desktop-session-context.tsx';
import { trashFolderPath } from '../../system/fs/path-utilities.mts';
import { useLiveQueryResult } from '../../system/hooks/use-live-query-result.mts';
import {
  describeFailedAction,
  useDesktopNoticeStore,
} from '../../system/notices/desktop-notice-store.mts';
import { translucentSurfaceBackdropFilter } from '../../system/theme/desktop-theme.mts';
import { selectWindowsInStackOrder } from '../../system/window-manager/window-manager-store.mts';
import { TrashCanIcon } from '../icons/system-icons.tsx';
import {
  buildDockEntries,
  computeNextDockFocusIndex,
  describeDockEntry,
  listDockMenuActions,
} from './dock-entries.mts';
import type { DockEntry, DockMenuActionId } from './dock-entries.mts';
import { DockItem } from './DockItem.tsx';

/** How long the launch bounce plays, in milliseconds. */
const launchBounceDurationInMilliseconds = 800;

/**
 * The Dock: apps, minimized windows and the Trash along the bottom of the screen, with hover
 * magnification, running indicators, launch bounce, right-click menus, and arrow-key navigation.
 * @returns The Dock.
 */
export function Dock(): JSX.Element {
  const { fileSystem, windowManagerStore } = useDesktopSession();
  const openApp = useOpenApp();
  const showNotice = useDesktopNoticeStore((noticeState) => noticeState.showNotice);
  const stackedWindows = useWindowManager(useShallow(selectWindowsInStackOrder));
  const pointerX = useMotionValue(Number.POSITIVE_INFINITY);
  const [bouncingAppId, setBouncingAppId] = useState<string>();
  const [focusableItemIndex, setFocusableItemIndex] = useState(0);
  // Only the item's key is remembered, so an open menu always reflects the item's current state
  // (for example "Empty Trash" becoming available while the menu is open).
  const [openContextMenu, setOpenContextMenu] = useState<{
    anchorElement: HTMLElement;
    dockEntryKey: string;
  }>();
  const itemButtonElements = useRef<(HTMLButtonElement | null)[]>([]);

  const countTrashItems = useCallback(
    async () => (await fileSystem.listFolder(trashFolderPath)).length,
    [fileSystem],
  );
  const { value: trashItemCount } = useLiveQueryResult(countTrashItems, 0);
  const dockEntries = buildDockEntries(
    appManifests,
    stackedWindows,
    trashItemCount,
    findAppManifest,
  );
  const windowManagerActions = windowManagerStore.getState();
  const contextMenuDockEntry = dockEntries.find(
    (dockEntry) => dockEntry.key === openContextMenu?.dockEntryKey,
  );

  /**
   * Performs a Dock item's main action (clicking it).
   * @param dockEntry - The item that was activated.
   */
  function activateDockEntry(dockEntry: DockEntry): void {
    if (dockEntry.kind === 'app') {
      if (!dockEntry.isRunning) {
        setBouncingAppId(dockEntry.appManifest.id);
        setTimeout(() => {
          setBouncingAppId(undefined);
        }, launchBounceDurationInMilliseconds);
      }
      openApp(dockEntry.appManifest.id);
    } else if (dockEntry.kind === 'minimized-window') {
      windowManagerActions.restoreWindow(dockEntry.windowState.id);
    }
    // The Trash opens in Finder, which arrives in Phase 2.
  }

  /**
   * Carries out an action chosen from a Dock item's right-click menu.
   * @param dockEntry - The item whose menu was used.
   * @param actionId - The chosen action.
   */
  function runDockMenuAction(dockEntry: DockEntry, actionId: DockMenuActionId): void {
    setOpenContextMenu(undefined);
    if (actionId === 'empty-trash') {
      fileSystem.emptyTrash().catch((emptyTrashError: unknown) => {
        showNotice(describeFailedAction('empty the Trash', emptyTrashError));
      });
    } else if (actionId === 'open' || actionId === 'show') {
      activateDockEntry(dockEntry);
    } else if (actionId === 'quit' && dockEntry.kind === 'app') {
      windowManagerActions.closeAllWindowsOfApp(dockEntry.appManifest.id);
    } else if (actionId === 'close' && dockEntry.kind === 'minimized-window') {
      windowManagerActions.closeWindow(dockEntry.windowState.id);
    }
  }

  /**
   * Moves keyboard focus between Dock items with the arrow, Home and End keys.
   * @param pressedKey - The key that was pressed.
   * @param currentIndex - The focused item's index.
   * @returns True when focus moved.
   */
  function moveDockFocus(pressedKey: string, currentIndex: number): boolean {
    const nextIndex = computeNextDockFocusIndex(pressedKey, currentIndex, dockEntries.length);
    if (nextIndex === undefined) {
      return false;
    }
    setFocusableItemIndex(nextIndex);
    itemButtonElements.current[nextIndex]?.focus();
    return true;
  }

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 6,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1050,
      }}
    >
      <Box
        role="toolbar"
        aria-label="Dock"
        aria-orientation="horizontal"
        onMouseMove={(mouseMoveEvent: MouseEvent) => {
          pointerX.set(mouseMoveEvent.clientX);
        }}
        onMouseLeave={() => {
          pointerX.set(Number.POSITIVE_INFINITY);
        }}
        sx={(theme) => ({
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1,
          px: 1,
          pt: 1,
          pb: 0.25,
          borderRadius: '18px',
          border: '0.5px solid rgba(255, 255, 255, 0.35)',
          backgroundColor: 'rgba(246, 246, 248, 0.45)',
          backdropFilter: translucentSurfaceBackdropFilter,
          ...theme.applyStyles('dark', {
            backgroundColor: 'rgba(40, 40, 44, 0.5)',
            borderColor: 'rgba(255, 255, 255, 0.15)',
          }),
          '@media (prefers-reduced-transparency: reduce)': {
            backdropFilter: 'none',
            backgroundColor: 'background.paper',
          },
        })}
      >
        {dockEntries.map((dockEntry, entryIndex) => {
          const { label, accessibleName } = describeDockEntry(dockEntry);
          const isFirstNonAppEntry =
            dockEntry.kind !== 'app' && dockEntries[entryIndex - 1]?.kind === 'app';
          return (
            <Fragment key={dockEntry.key}>
              {isFirstNonAppEntry ? (
                <Divider
                  orientation="vertical"
                  flexItem
                  sx={{ mx: 0.5, my: 1, borderColor: 'divider' }}
                />
              ) : null}
              <DockItem
                label={label}
                accessibleName={accessibleName}
                icon={
                  dockEntry.kind === 'trash' ? (
                    <TrashCanIcon size={64} isFull={dockEntry.isFull} />
                  ) : (
                    <dockEntry.appManifest.AppIcon size={64} />
                  )
                }
                pointerX={pointerX}
                {...(dockEntry.kind === 'app' ? { isRunning: dockEntry.isRunning } : {})}
                isBouncing={dockEntry.kind === 'app' && bouncingAppId === dockEntry.appManifest.id}
                tabIndex={entryIndex === focusableItemIndex ? 0 : -1}
                buttonRef={(buttonElement) => {
                  itemButtonElements.current[entryIndex] = buttonElement;
                }}
                onClick={() => {
                  setFocusableItemIndex(entryIndex);
                  activateDockEntry(dockEntry);
                }}
                onContextMenu={(contextMenuEvent) => {
                  contextMenuEvent.preventDefault();
                  setOpenContextMenu({
                    anchorElement: contextMenuEvent.currentTarget,
                    dockEntryKey: dockEntry.key,
                  });
                }}
                onKeyDown={(keyboardEvent) => {
                  if (moveDockFocus(keyboardEvent.key, entryIndex)) {
                    keyboardEvent.preventDefault();
                  }
                }}
              />
            </Fragment>
          );
        })}
      </Box>
      <Menu
        open={contextMenuDockEntry !== undefined}
        anchorEl={openContextMenu?.anchorElement}
        onClose={() => {
          setOpenContextMenu(undefined);
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {contextMenuDockEntry === undefined
          ? null
          : listDockMenuActions(contextMenuDockEntry).map((dockMenuAction) => (
              <MenuItem
                key={dockMenuAction.actionId}
                disabled={dockMenuAction.isDisabled}
                onClick={() => {
                  runDockMenuAction(contextMenuDockEntry, dockMenuAction.actionId);
                }}
              >
                {dockMenuAction.label}
              </MenuItem>
            ))}
      </Menu>
    </Box>
  );
}
