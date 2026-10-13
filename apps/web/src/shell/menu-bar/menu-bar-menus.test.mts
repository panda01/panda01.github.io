import { describe, expect, it } from 'vitest';
import type { DesktopWindowState } from '../../system/window-manager/window.types.mts';
import { buildMenuBarMenus, chooseNewFolderLocation } from './menu-bar-menus.mts';
import type { MenuBarMenu } from './menu-bar-menus.mts';

/**
 * Finds a menu by id, failing the test if it is missing.
 * @param menuBarMenus - The menus to search.
 * @param menuId - The menu's id.
 * @returns The menu.
 */
function findMenu(menuBarMenus: MenuBarMenu[], menuId: MenuBarMenu['menuId']): MenuBarMenu {
  const foundMenu = menuBarMenus.find((menuBarMenu) => menuBarMenu.menuId === menuId);
  if (foundMenu === undefined) {
    throw new Error(`Missing menu ${menuId}`);
  }
  return foundMenu;
}

describe('buildMenuBarMenus', () => {
  it('builds the system, app, File and Window menus in order', () => {
    const menuBarMenus = buildMenuBarMenus({
      focusedAppName: 'Finder',
      hasFocusedWindow: false,
      isFullScreen: false,
    });

    expect(menuBarMenus.map((menuBarMenu) => menuBarMenu.buttonLabel)).toEqual([
      'System menu',
      'Finder',
      'File',
      'Window',
    ]);
    expect(findMenu(menuBarMenus, 'system').items.map((menuItem) => menuItem.label)).toEqual([
      'About This Mac',
      'Enter Full Screen',
      'Reset Desktop…',
    ]);
  });

  it('disables window actions when no window is focused', () => {
    const menuBarMenus = buildMenuBarMenus({
      focusedAppName: 'Finder',
      hasFocusedWindow: false,
      isFullScreen: false,
    });

    expect(findMenu(menuBarMenus, 'app').items[0]).toMatchObject({
      label: 'Quit Finder',
      isDisabled: true,
    });
    expect(findMenu(menuBarMenus, 'window').items.every((menuItem) => menuItem.isDisabled)).toBe(
      true,
    );
    expect(
      findMenu(menuBarMenus, 'file').items.map((menuItem) => [menuItem.label, menuItem.isDisabled]),
    ).toEqual([
      ['New Finder Window', false],
      ['New Folder', false],
      ['Close Window', true],
    ]);
  });

  it('enables window actions and offers Exit Full Screen when appropriate', () => {
    const menuBarMenus = buildMenuBarMenus({
      focusedAppName: 'About This Mac',
      hasFocusedWindow: true,
      isFullScreen: true,
    });

    expect(findMenu(menuBarMenus, 'app').items[0]).toMatchObject({
      label: 'Quit About This Mac',
      shortcutHint: '⌥Q',
      isDisabled: false,
    });
    expect(findMenu(menuBarMenus, 'window').items.some((menuItem) => menuItem.isDisabled)).toBe(
      false,
    );
    expect(findMenu(menuBarMenus, 'system').items[1]?.label).toBe('Exit Full Screen');
  });
});

describe('chooseNewFolderLocation', () => {
  /**
   * Builds a window of an app showing a launch argument.
   * @param appId - The window's app.
   * @param launchArgument - What it shows.
   * @returns The window state.
   */
  function buildWindow(appId: string, launchArgument?: string): DesktopWindowState {
    return {
      id: 'w',
      appId,
      title: 'w',
      bounds: { x: 0, y: 0, width: 300, height: 200 },
      isMinimized: false,
      isZoomed: false,
      ...(launchArgument === undefined ? {} : { launchArgument }),
    };
  }

  it('uses the focused Finder window’s folder, otherwise the desktop, never the Trash', () => {
    expect(chooseNewFolderLocation(buildWindow('finder', '/Users/guest/Projects'))).toBe(
      '/Users/guest/Projects',
    );
    expect(chooseNewFolderLocation(undefined)).toBe('/Users/guest/Desktop');
    expect(chooseNewFolderLocation(buildWindow('get-info', '/Users/guest/Projects'))).toBe(
      '/Users/guest/Desktop',
    );
    expect(chooseNewFolderLocation(buildWindow('finder', '/Users/guest/.Trash'))).toBe(
      '/Users/guest/Desktop',
    );
    expect(chooseNewFolderLocation(buildWindow('finder'))).toBe('/Users/guest/Desktop');
  });
});
