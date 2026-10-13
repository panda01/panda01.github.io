import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import type { FileItemInteractionHandlers } from '../../shell/item-views/use-file-item-interactions.mts';

/** Everything one item in a Finder view responds to, including the end of an inline rename. */
export interface FinderItemHandlers extends FileItemInteractionHandlers {
  onFinishRenaming: (requestedName: string | undefined) => void;
}

/** What every Finder view (icons, list) needs to draw a folder's items. */
export interface FinderItemViewProps {
  /** The window showing the view; it identifies the view's items for drag-and-drop. */
  windowId: string;
  items: readonly FileSystemItem[];
  selectedItemPath: string | undefined;
  renamingItemPath: string | undefined;
  /** Builds the handlers for one item. */
  buildItemHandlers: (item: FileSystemItem) => FinderItemHandlers;
}
