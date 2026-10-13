import {
  AboutThisMacAppIcon,
  FinderAppIcon,
  QuickLookAppIcon,
} from '../../shell/icons/system-icons.tsx';
import { getBaseName, getFolderDisplayName, homeFolderPath } from '../fs/path-utilities.mts';
import type { OpenWindowRequest } from '../window-manager/window-manager-store.mts';
import type { AppManifest, LoadedWindowContentModule } from './app-manifest.types.mts';

/** Id of Finder (one window per folder; a new window shows the home folder). */
export const finderAppId = 'finder';

/** Id of Quick Look (one preview window that switches to whichever item is previewed). */
export const quickLookAppId = 'quick-look';

/** Id of the About This Mac app. */
export const aboutThisMacAppId = 'about-this-mac';

/**
 * Loads the Finder window content.
 * @returns The module in React.lazy's shape.
 */
async function loadFinderWindowContent(): Promise<LoadedWindowContentModule> {
  const { Finder } = await import('../../apps/finder/Finder.tsx');
  return { default: Finder };
}

/**
 * Loads the Quick Look window content.
 * @returns The module in React.lazy's shape.
 */
async function loadQuickLookWindowContent(): Promise<LoadedWindowContentModule> {
  const { QuickLook } = await import('../../apps/quick-look/QuickLook.tsx');
  return { default: QuickLook };
}

/** Id of the Get Info app (one window per item, not shown in the Dock). */
export const getInfoAppId = 'get-info';

/**
 * Loads the About This Mac window content.
 * @returns The module in React.lazy's shape.
 */
async function loadAboutThisMacWindowContent(): Promise<LoadedWindowContentModule> {
  const { AboutThisMac } = await import('../../apps/about-this-mac/AboutThisMac.tsx');
  return { default: AboutThisMac };
}

/**
 * Loads the Get Info window content.
 * @returns The module in React.lazy's shape.
 */
async function loadGetInfoWindowContent(): Promise<LoadedWindowContentModule> {
  const { GetInfo } = await import('../../apps/get-info/GetInfo.tsx');
  return { default: GetInfo };
}

/**
 * Title for Finder windows: the name of the folder shown ("Macintosh HD" for the root).
 * @param folderPath - The folder the window shows (the home folder when omitted).
 * @returns The window title.
 */
function createFinderWindowTitle(folderPath: string | undefined): string {
  return getFolderDisplayName(folderPath ?? homeFolderPath);
}

/**
 * Title for the Quick Look window: the name of the previewed item.
 * @param previewedItemPath - Path of the previewed item.
 * @returns The window title.
 */
function createQuickLookWindowTitle(previewedItemPath: string | undefined): string {
  return getBaseName(previewedItemPath ?? '/') || 'Quick Look';
}

/**
 * Title for About This Mac windows.
 * @returns The window title.
 */
function createAboutThisMacWindowTitle(): string {
  return 'About This Mac';
}

/**
 * Title for Get Info windows, like Finder's "Resume.pdf Info".
 * @param describedItemPath - Path of the item the window describes.
 * @returns The window title.
 */
function createGetInfoWindowTitle(describedItemPath: string | undefined): string {
  return `${getBaseName(describedItemPath ?? '/') || 'Macintosh HD'} Info`;
}

/**
 * Every app the desktop knows about, in Dock order (Finder first, like macOS). Later phases add
 * Terminal and Browser here.
 */
export const appManifests: readonly AppManifest[] = [
  {
    id: finderAppId,
    displayName: 'Finder',
    AppIcon: FinderAppIcon,
    loadWindowContent: loadFinderWindowContent,
    defaultWindowSize: { width: 780, height: 460 },
    allowsMultipleWindows: true,
    isShownInDock: true,
    isListedAsApplication: true,
    createWindowTitle: createFinderWindowTitle,
  },
  {
    id: aboutThisMacAppId,
    displayName: 'About This Mac',
    AppIcon: AboutThisMacAppIcon,
    loadWindowContent: loadAboutThisMacWindowContent,
    defaultWindowSize: { width: 440, height: 320 },
    allowsMultipleWindows: false,
    isShownInDock: true,
    isListedAsApplication: true,
    createWindowTitle: createAboutThisMacWindowTitle,
  },
  {
    id: getInfoAppId,
    displayName: 'Get Info',
    AppIcon: AboutThisMacAppIcon,
    loadWindowContent: loadGetInfoWindowContent,
    defaultWindowSize: { width: 300, height: 400 },
    allowsMultipleWindows: true,
    isShownInDock: false,
    isListedAsApplication: false,
    createWindowTitle: createGetInfoWindowTitle,
  },
  {
    id: quickLookAppId,
    displayName: 'Quick Look',
    AppIcon: QuickLookAppIcon,
    loadWindowContent: loadQuickLookWindowContent,
    defaultWindowSize: { width: 620, height: 540 },
    allowsMultipleWindows: false,
    isShownInDock: false,
    isListedAsApplication: false,
    createWindowTitle: createQuickLookWindowTitle,
  },
];

/**
 * Looks up an app by id.
 * @param appId - The app's id.
 * @returns The app's manifest, or undefined for unknown ids (for example from an old saved layout).
 */
export function findAppManifest(appId: string): AppManifest | undefined {
  return appManifests.find((appManifest) => appManifest.id === appId);
}

/**
 * Builds the window-manager request that opens an app's window.
 * @param appManifest - The app to open.
 * @param launchArgument - Optional app-specific input (for Get Info, the item's path).
 * @returns The request to pass to the window manager.
 */
export function buildOpenWindowRequest(
  appManifest: AppManifest,
  launchArgument?: string,
): OpenWindowRequest {
  return {
    appId: appManifest.id,
    title: appManifest.createWindowTitle(launchArgument),
    defaultSize: appManifest.defaultWindowSize,
    allowsMultipleWindows: appManifest.allowsMultipleWindows,
    ...(launchArgument === undefined ? {} : { launchArgument }),
  };
}
