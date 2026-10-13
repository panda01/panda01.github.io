import type { ComponentType } from 'react';

/** Props every app's window content receives. */
export interface AppWindowContentProps {
  /** Id of the window showing this content. */
  windowId: string;
  /** App-specific input the window was opened with (for example a file path). */
  launchArgument?: string;
}

/** A lazily loaded window content module, in the shape React.lazy expects. */
export interface LoadedWindowContentModule {
  default: ComponentType<AppWindowContentProps>;
}

/** Everything the desktop needs to know about an app. */
export interface AppManifest {
  id: string;
  /** Name shown in the menu bar, Dock tooltip and menus. */
  displayName: string;
  /** The app's original icon artwork. */
  AppIcon: ComponentType<{ size: number }>;
  /** Loads the window content on demand, so an app's code downloads only when it is opened. */
  loadWindowContent: () => Promise<LoadedWindowContentModule>;
  defaultWindowSize: { width: number; height: number };
  /** Whether the app can have several windows at once. */
  allowsMultipleWindows: boolean;
  /** Whether the app has a permanent place in the Dock. */
  isShownInDock: boolean;
  /**
   * Whether visitors can launch the app themselves (it appears in Spotlight). Helper windows such
   * as Get Info and Quick Look only open from other apps.
   */
  isListedAsApplication: boolean;
  /** Builds a window's title from its launch argument. */
  createWindowTitle: (launchArgument: string | undefined) => string;
}
