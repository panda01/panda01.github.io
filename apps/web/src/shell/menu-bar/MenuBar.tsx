import { useId } from 'react';
import type { JSX } from 'react';
import { Box, Button, Divider, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import {
  aboutThisMacAppId,
  findAppManifest,
  finderAppId,
} from '../../system/app-registry/app-registry.mts';
import {
  useDesktopSession,
  useOpenApp,
  useWindowManager,
} from '../../system/desktop-session/desktop-session-context.tsx';
import { createUntitledFolder } from '../../system/item-actions/item-actions.mts';
import { useMenuState } from '../../system/hooks/use-menu-state.mts';
import {
  describeFailedAction,
  useDesktopNoticeStore,
} from '../../system/notices/desktop-notice-store.mts';
import { translucentSurfaceBackdropFilter } from '../../system/theme/desktop-theme.mts';
import { menuBarHeightInPixels } from '../../system/window-manager/window-geometry.mts';
import { selectFocusedWindow } from '../../system/window-manager/window-manager-store.mts';
import { SystemLogoIcon } from '../icons/system-icons.tsx';
import type { FullScreenControls } from '../keyboard/use-full-screen-state.mts';
import { useSpotlightStore } from '../spotlight/spotlight-store.mts';
import { buildMenuBarMenus, chooseNewFolderLocation } from './menu-bar-menus.mts';
import type { MenuBarActionId, MenuBarMenu } from './menu-bar-menus.mts';
import { MenuBarClock } from './MenuBarClock.tsx';

/** Props for the menu bar. */
export interface MenuBarProps {
  fullScreenControls: FullScreenControls;
  /** Asks the desktop to show the "Reset Desktop?" confirmation. */
  onRequestDesktopReset: () => void;
}

/**
 * The menu bar across the top of the screen: the system (logo) menu, the focused app's name and
 * menus, the Spotlight button, and the clock.
 * @param props - Full-screen controls and the reset request handler.
 * @param props.fullScreenControls - Full-screen state and actions.
 * @param props.onRequestDesktopReset - Shows the reset confirmation.
 * @returns The menu bar.
 */
export function MenuBar({ fullScreenControls, onRequestDesktopReset }: MenuBarProps): JSX.Element {
  const { fileSystem, windowManagerStore } = useDesktopSession();
  const openApp = useOpenApp();
  const showNotice = useDesktopNoticeStore((noticeState) => noticeState.showNotice);
  const openSpotlight = useSpotlightStore((spotlightState) => spotlightState.openSpotlight);
  const focusedWindow = useWindowManager(selectFocusedWindow);
  const {
    menuContent: openMenu,
    isMenuOpen,
    showMenu,
    hideMenu,
  } = useMenuState<{ menu: MenuBarMenu; anchorElement: HTMLElement }>();
  const openMenuElementId = useId();

  const focusedAppName =
    focusedWindow === undefined
      ? 'Finder'
      : (findAppManifest(focusedWindow.appId)?.displayName ?? 'Finder');
  const menuBarMenus = buildMenuBarMenus({
    focusedAppName,
    hasFocusedWindow: focusedWindow !== undefined,
    isFullScreen: fullScreenControls.isFullScreen,
  });

  /**
   * Carries out the chosen menu item.
   * @param actionId - The chosen action.
   */
  function runMenuBarAction(actionId: MenuBarActionId): void {
    hideMenu();
    const windowManagerActions = windowManagerStore.getState();
    switch (actionId) {
      case 'about-this-mac':
        openApp(aboutThisMacAppId);
        return;
      case 'toggle-full-screen':
        if (fullScreenControls.isFullScreen) {
          fullScreenControls.exitFullScreen();
        } else {
          fullScreenControls.enterFullScreen();
        }
        return;
      case 'reset-desktop':
        onRequestDesktopReset();
        return;
      case 'new-finder-window':
        openApp(finderAppId);
        return;
      case 'new-folder':
        createUntitledFolder(fileSystem, chooseNewFolderLocation(focusedWindow)).catch(
          (newFolderError: unknown) => {
            showNotice(describeFailedAction('create the folder', newFolderError));
          },
        );
        return;
    }
    if (focusedWindow === undefined) {
      return;
    }
    switch (actionId) {
      case 'quit-app':
        windowManagerActions.closeAllWindowsOfApp(focusedWindow.appId);
        return;
      case 'close-window':
        windowManagerActions.closeWindow(focusedWindow.id);
        return;
      case 'minimize-window':
        windowManagerActions.minimizeWindow(focusedWindow.id);
        return;
      case 'zoom-window':
        windowManagerActions.toggleWindowZoom(focusedWindow.id);
        return;
    }
  }

  return (
    <Box
      component="nav"
      aria-label="Menu bar"
      sx={(theme) => ({
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: menuBarHeightInPixels,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        px: 1,
        color: 'text.primary',
        backgroundColor: 'rgba(246, 246, 248, 0.6)',
        backdropFilter: translucentSurfaceBackdropFilter,
        ...theme.applyStyles('dark', { backgroundColor: 'rgba(30, 30, 32, 0.55)' }),
        '@media (prefers-reduced-transparency: reduce)': {
          backdropFilter: 'none',
          backgroundColor: 'background.paper',
        },
      })}
    >
      {menuBarMenus.map((menuBarMenu) => {
        const isThisMenuOpen = isMenuOpen && openMenu?.menu.menuId === menuBarMenu.menuId;
        return (
          <Button
            key={menuBarMenu.menuId}
            color="inherit"
            aria-label={menuBarMenu.menuId === 'system' ? 'System menu' : menuBarMenu.buttonLabel}
            aria-haspopup="menu"
            aria-expanded={isThisMenuOpen}
            {...(isThisMenuOpen ? { 'aria-controls': openMenuElementId } : {})}
            onClick={(clickEvent) => {
              showMenu({ menu: menuBarMenu, anchorElement: clickEvent.currentTarget });
            }}
            sx={{
              minWidth: 0,
              height: 24,
              px: 1.25,
              fontSize: 13,
              fontWeight: menuBarMenu.menuId === 'app' ? 700 : 500,
              borderRadius: 1,
              bgcolor: isThisMenuOpen ? 'action.selected' : 'transparent',
            }}
          >
            {menuBarMenu.menuId === 'system' ? (
              <SystemLogoIcon size={15} />
            ) : (
              menuBarMenu.buttonLabel
            )}
          </Button>
        );
      })}
      <Box sx={{ flex: 1 }} />
      <IconButton
        color="inherit"
        aria-label="Spotlight"
        onClick={openSpotlight}
        sx={{ width: 28, height: 24, borderRadius: 1, mr: 0.5 }}
      >
        <SearchIcon sx={{ fontSize: 17 }} />
      </IconButton>
      <MenuBarClock />
      <Menu
        id={openMenuElementId}
        open={isMenuOpen && openMenu !== undefined}
        anchorEl={openMenu?.anchorElement}
        onClose={hideMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {openMenu?.menu.items.flatMap((menuItem) => [
          ...(menuItem.hasDividerBefore === true
            ? [<Divider key={`${menuItem.actionId}-divider`} />]
            : []),
          <MenuItem
            key={menuItem.actionId}
            disabled={menuItem.isDisabled}
            onClick={() => {
              runMenuBarAction(menuItem.actionId);
            }}
          >
            <Box component="span" sx={{ flex: 1 }}>
              {menuItem.label}
            </Box>
            {menuItem.shortcutHint === undefined ? null : (
              <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary', ml: 3 }}>
                {menuItem.shortcutHint}
              </Typography>
            )}
          </MenuItem>,
        ])}
      </Menu>
    </Box>
  );
}
