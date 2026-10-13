import { finderAppId } from '../../system/app-registry/app-registry.mts';
import {
  desktopFolderPath,
  isPathInsideFolder,
  trashFolderPath,
} from '../../system/fs/path-utilities.mts';
import type { DesktopWindowState } from '../../system/window-manager/window.types.mts';

/** Every action the menu bar can trigger. */
export type MenuBarActionId =
  | 'about-this-mac'
  | 'toggle-full-screen'
  | 'reset-desktop'
  | 'quit-app'
  | 'new-finder-window'
  | 'new-folder'
  | 'close-window'
  | 'minimize-window'
  | 'zoom-window';

/** One item inside a menu bar menu. */
export interface MenuBarMenuItem {
  actionId: MenuBarActionId;
  label: string;
  /** Keyboard shortcut shown at the right edge, for example "⌥W". */
  shortcutHint?: string;
  isDisabled: boolean;
  /** Draws a separator line above this item. */
  hasDividerBefore?: boolean;
}

/** One menu in the menu bar (the logo menu, the app menu, File, Window). */
export interface MenuBarMenu {
  menuId: 'system' | 'app' | 'file' | 'window';
  /** Text on the menu bar button (the system menu shows the logo instead). */
  buttonLabel: string;
  items: MenuBarMenuItem[];
}

/** What the menus depend on. */
export interface MenuBarContext {
  /** Name of the focused app, or "Finder" when no window is focused. */
  focusedAppName: string;
  hasFocusedWindow: boolean;
  isFullScreen: boolean;
}

/**
 * Builds the menu bar's menus for the current situation (which app is focused, whether a window is
 * focused, whether the page is full-screen).
 * @param menuBarContext - The current situation.
 * @returns The menus, left to right.
 */
export function buildMenuBarMenus(menuBarContext: MenuBarContext): MenuBarMenu[] {
  const { focusedAppName, hasFocusedWindow, isFullScreen } = menuBarContext;
  return [
    {
      menuId: 'system',
      buttonLabel: 'System menu',
      items: [
        { actionId: 'about-this-mac', label: 'About This Mac', isDisabled: false },
        {
          actionId: 'toggle-full-screen',
          label: isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen',
          isDisabled: false,
          hasDividerBefore: true,
        },
        {
          actionId: 'reset-desktop',
          label: 'Reset Desktop…',
          isDisabled: false,
          hasDividerBefore: true,
        },
      ],
    },
    {
      menuId: 'app',
      buttonLabel: focusedAppName,
      items: [
        {
          actionId: 'quit-app',
          label: `Quit ${focusedAppName}`,
          shortcutHint: '⌥Q',
          isDisabled: !hasFocusedWindow,
        },
      ],
    },
    {
      menuId: 'file',
      buttonLabel: 'File',
      items: [
        {
          actionId: 'new-finder-window',
          label: 'New Finder Window',
          shortcutHint: '⌥N',
          isDisabled: false,
        },
        { actionId: 'new-folder', label: 'New Folder', isDisabled: false },
        {
          actionId: 'close-window',
          label: 'Close Window',
          shortcutHint: '⌥W',
          isDisabled: !hasFocusedWindow,
          hasDividerBefore: true,
        },
      ],
    },
    {
      menuId: 'window',
      buttonLabel: 'Window',
      items: [
        {
          actionId: 'minimize-window',
          label: 'Minimize',
          shortcutHint: '⌥M',
          isDisabled: !hasFocusedWindow,
        },
        { actionId: 'zoom-window', label: 'Zoom', isDisabled: !hasFocusedWindow },
      ],
    },
  ];
}

/**
 * Decides where File › New Folder creates the folder: in the folder shown by the focused Finder
 * window, or on the desktop otherwise (and never inside the Trash).
 * @param focusedWindow - The focused window, if any.
 * @returns The folder to create the new folder in.
 */
export function chooseNewFolderLocation(focusedWindow: DesktopWindowState | undefined): string {
  const finderFolderPath =
    focusedWindow?.appId === finderAppId ? focusedWindow.launchArgument : undefined;
  const canCreateInFinderFolder =
    finderFolderPath !== undefined && !isPathInsideFolder(finderFolderPath, trashFolderPath);
  return canCreateInFinderFolder ? finderFolderPath : desktopFolderPath;
}
