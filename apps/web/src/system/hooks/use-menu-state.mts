import { useCallback, useState } from 'react';

/** A menu's open state plus what it shows. */
export interface MenuState<MenuContent> {
  /** What the menu shows. Kept after the menu closes, so it does not go blank while fading out. */
  menuContent: MenuContent | undefined;
  isMenuOpen: boolean;
  showMenu: (menuContent: MenuContent) => void;
  hideMenu: () => void;
}

/**
 * Tracks a menu that opens with some content (for example the item that was right-clicked).
 * Closing only hides the menu: its content stays until the next opening, so the menu keeps its
 * entries during the closing fade instead of shrinking to an empty box (found in the Phase 2
 * walkthrough).
 * @returns The menu's content, whether it is open, and functions to show and hide it.
 */
export function useMenuState<MenuContent>(): MenuState<MenuContent> {
  const [menuContent, setMenuContent] = useState<MenuContent>();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const showMenu = useCallback((newMenuContent: MenuContent) => {
    setMenuContent(newMenuContent);
    setIsMenuOpen(true);
  }, []);
  const hideMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);
  return { menuContent, isMenuOpen, showMenu, hideMenu };
}
