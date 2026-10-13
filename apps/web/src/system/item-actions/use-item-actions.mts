import { useMemo } from 'react';
import { finderAppId, getInfoAppId } from '../app-registry/app-registry.mts';
import { useDesktopSession, useOpenApp } from '../desktop-session/desktop-session-context.tsx';
import type { FileSystemItem } from '../fs/file-system.types.mts';
import { getParentPath } from '../fs/path-utilities.mts';
import { describeFailedAction, useDesktopNoticeStore } from '../notices/desktop-notice-store.mts';
import {
  createUntitledFolder,
  downloadFileToComputer,
  openUrlInNewBrowserTab,
  planItemOpening,
  renameItemFromField,
  resolveItemOpeningPlan,
} from './item-actions.mts';
import type { ItemOpeningPlan } from './item-actions.mts';
import type { ItemMenuActionId } from './item-menu.mts';
import { openQuickLookForItem, toggleQuickLookForItem } from './quick-look-controls.mts';

/** Optional behaviour that depends on where the item is shown (the desktop or a Finder window). */
export interface ItemActionOptions {
  /** Finder shows an opened folder in the same window; the desktop opens a Finder window instead. */
  showFolderInPlace?: (folderPath: string) => void;
  /** Shows the inline name field for an item (the Rename menu entry). */
  startRenamingItem?: (itemPath: string) => void;
}

/** Everything the desktop and Finder can do with items, with failures reported as notices. */
export interface ItemActions {
  /** Opens an item: folders in Finder, files in Quick Look, links in a new browser tab. */
  openItem: (item: FileSystemItem, actionOptions?: ItemActionOptions) => void;
  /** The Space bar: opens Quick Look on an item, or closes it when it already shows that item. */
  toggleQuickLook: (itemPath: string) => void;
  /** Carries out an entry chosen from an item's right-click menu. */
  runItemMenuAction: (
    actionId: ItemMenuActionId,
    item: FileSystemItem,
    actionOptions?: ItemActionOptions,
  ) => void;
  /** Renames an item from an inline name field; resolves to the renamed item, if it changed. */
  renameItem: (item: FileSystemItem, requestedName: string) => Promise<FileSystemItem | undefined>;
  /** Creates an "untitled folder"; resolves to it, or undefined when that failed. */
  createFolderIn: (parentFolderPath: string) => Promise<FileSystemItem | undefined>;
  /** Permanently deletes everything in the Trash. */
  emptyTrash: () => void;
}

/**
 * Provides the item actions shared by the desktop and Finder, so both behave the same way.
 * @returns The item actions.
 */
export function useItemActions(): ItemActions {
  const { fileSystem, windowManagerStore } = useDesktopSession();
  const openApp = useOpenApp();
  const showNotice = useDesktopNoticeStore((noticeState) => noticeState.showNotice);

  return useMemo(() => {
    /**
     * Creates a handler that turns a failed action into a notice.
     * @param actionDescription - What was attempted, for example "move “Notes” to the Trash".
     * @returns The error handler.
     */
    function reportFailureOf(actionDescription: string): (failure: unknown) => void {
      return (failure: unknown) => {
        showNotice(describeFailedAction(actionDescription, failure));
      };
    }

    /**
     * Carries out an opening plan.
     * @param openingPlan - What opening the item does.
     * @param actionOptions - Where the item is shown.
     */
    function carryOutOpeningPlan(
      openingPlan: ItemOpeningPlan,
      actionOptions: ItemActionOptions,
    ): void {
      switch (openingPlan.kind) {
        case 'show-folder':
          if (actionOptions.showFolderInPlace === undefined) {
            openApp(finderAppId, openingPlan.folderPath);
          } else {
            actionOptions.showFolderInPlace(openingPlan.folderPath);
          }
          return;
        case 'preview-file':
          openQuickLookForItem(windowManagerStore, openingPlan.filePath);
          return;
        case 'open-url':
          openUrlInNewBrowserTab(openingPlan.url);
          return;
        case 'missing-original':
          showNotice(
            `The alias “${openingPlan.aliasName}” can’t be opened because the original item can’t be found.`,
          );
          return;
      }
    }

    /**
     * Opens an item. Only aliases need a lookup first; everything else opens at once, so web links
     * open in the same click (browsers block new tabs opened later).
     * @param item - The item to open.
     * @param actionOptions - Where the item is shown.
     */
    function openItem(item: FileSystemItem, actionOptions: ItemActionOptions = {}): void {
      const isAlias = item.linkTarget?.kind === 'path';
      if (!isAlias) {
        carryOutOpeningPlan(planItemOpening(item, undefined), actionOptions);
        return;
      }
      resolveItemOpeningPlan(fileSystem, item).then(
        (openingPlan) => {
          carryOutOpeningPlan(openingPlan, actionOptions);
        },
        reportFailureOf(`open “${item.name}”`),
      );
    }

    return {
      openItem,
      /**
       * Opens or closes Quick Look on an item.
       * @param itemPath - The item's path.
       */
      toggleQuickLook: (itemPath) => {
        toggleQuickLookForItem(windowManagerStore, itemPath);
      },
      /**
       * Carries out a right-click menu entry.
       * @param actionId - The chosen entry.
       * @param item - The item it applies to.
       * @param actionOptions - Where the item is shown.
       */
      runItemMenuAction: (actionId, item, actionOptions = {}) => {
        switch (actionId) {
          case 'open':
            openItem(item, actionOptions);
            return;
          case 'quick-look':
            openQuickLookForItem(windowManagerStore, item.path);
            return;
          case 'get-info':
            openApp(getInfoAppId, item.path);
            return;
          case 'rename':
            actionOptions.startRenamingItem?.(item.path);
            return;
          case 'duplicate':
            fileSystem
              .copy(item.path, getParentPath(item.path))
              .catch(reportFailureOf(`duplicate “${item.name}”`));
            return;
          case 'download':
            downloadFileToComputer(fileSystem, item.path).catch(
              reportFailureOf(`download “${item.name}”`),
            );
            return;
          case 'move-to-trash':
            fileSystem
              .moveToTrash(item.path)
              .catch(reportFailureOf(`move “${item.name}” to the Trash`));
            return;
          case 'put-back':
            fileSystem.putBack(item.path).catch(reportFailureOf(`put back “${item.name}”`));
            return;
          case 'delete-immediately':
            fileSystem.remove(item.path).catch(reportFailureOf(`delete “${item.name}”`));
            return;
        }
      },
      /**
       * Renames an item, reporting a clash or invalid name as a notice.
       * @param item - The item being renamed.
       * @param requestedName - What the visitor typed.
       * @returns The renamed item, or undefined when nothing changed or the rename failed.
       */
      renameItem: async (item, requestedName) => {
        try {
          return await renameItemFromField(fileSystem, item, requestedName);
        } catch (renameFailure) {
          reportFailureOf(`rename “${item.name}”`)(renameFailure);
          return undefined;
        }
      },
      /**
       * Creates an "untitled folder" in a folder.
       * @param parentFolderPath - Where to create it.
       * @returns The new folder, or undefined when creating it failed.
       */
      createFolderIn: async (parentFolderPath) => {
        try {
          return await createUntitledFolder(fileSystem, parentFolderPath);
        } catch (newFolderFailure) {
          reportFailureOf('create the folder')(newFolderFailure);
          return undefined;
        }
      },
      /**
       * Empties the Trash.
       */
      emptyTrash: () => {
        fileSystem.emptyTrash().catch(reportFailureOf('empty the Trash'));
      },
    };
  }, [fileSystem, windowManagerStore, openApp, showNotice]);
}
