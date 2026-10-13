import type { ReactNode } from 'react';
import { Divider, MenuItem } from '@mui/material';
import type { ItemMenuAction } from '../../system/item-actions/item-menu.mts';

/**
 * Turns right-click menu entries into MUI menu items, with dividers where the entries ask for one.
 * Shared by the desktop's and Finder's menus so they look and behave the same.
 * @param menuActions - The entries, top to bottom.
 * @param onChoose - Called with the chosen entry's id.
 * @returns The menu's children.
 */
export function renderMenuEntries<MenuActionId extends string>(
  menuActions: readonly ItemMenuAction<MenuActionId>[],
  onChoose: (actionId: MenuActionId) => void,
): ReactNode[] {
  return menuActions.flatMap((menuAction) => [
    ...(menuAction.hasDividerBefore === true
      ? [<Divider key={`${menuAction.actionId}-divider`} />]
      : []),
    <MenuItem
      key={menuAction.actionId}
      disabled={menuAction.isDisabled}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onChoose(menuAction.actionId);
      }}
    >
      {menuAction.label}
    </MenuItem>,
  ]);
}
