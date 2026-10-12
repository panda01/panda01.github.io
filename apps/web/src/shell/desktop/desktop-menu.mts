import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import { canOpenItem } from './desktop-actions.mts';

/** Actions offered by the desktop's right-click menus. */
export type DesktopMenuActionId = 'open' | 'get-info' | 'move-to-trash' | 'new-folder';

/** One entry of a desktop right-click menu. */
export interface DesktopMenuAction {
  actionId: DesktopMenuActionId;
  label: string;
  isDisabled: boolean;
  hasDividerBefore?: boolean;
}

/**
 * Lists the right-click menu for the desktop: an item's menu when an icon was right-clicked,
 * otherwise the menu for empty desktop space.
 * @param targetItem - The right-clicked item, or undefined for empty space.
 * @returns The menu entries, top to bottom.
 */
export function listDesktopMenuActions(
  targetItem: FileSystemItem | undefined,
): DesktopMenuAction[] {
  if (targetItem === undefined) {
    return [{ actionId: 'new-folder', label: 'New Folder', isDisabled: false }];
  }
  return [
    { actionId: 'open', label: 'Open', isDisabled: !canOpenItem(targetItem) },
    { actionId: 'get-info', label: 'Get Info', isDisabled: false, hasDividerBefore: true },
    {
      actionId: 'move-to-trash',
      label: 'Move to Trash',
      isDisabled: false,
      hasDividerBefore: true,
    },
  ];
}
