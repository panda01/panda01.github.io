/** A rectangle in CSS pixels, relative to the top-left of the desktop area below the menu bar. */
export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The size of the area windows may occupy (the screen minus the menu bar). */
export interface DesktopAreaSize {
  width: number;
  height: number;
}

/** Everything the window manager tracks about one open window. */
export interface DesktopWindowState {
  /** Unique id of this window. */
  id: string;
  /** Id of the app that owns the window (see the app registry). */
  appId: string;
  /** Optional app-specific input, for example the path whose Get Info window this is. */
  launchArgument?: string;
  /** Text shown in the title bar and used as the window's accessible name. */
  title: string;
  /** Current position and size. */
  bounds: WindowBounds;
  /** Position and size to return to when a zoomed window is un-zoomed. */
  boundsBeforeZoom?: WindowBounds;
  isMinimized: boolean;
  isZoomed: boolean;
}

/** A window as saved in IndexedDB so the layout survives a reload. */
export interface PersistedWindowRecord extends DesktopWindowState {
  /** Position in the stacking order; higher numbers are drawn on top. */
  stackPosition: number;
}
