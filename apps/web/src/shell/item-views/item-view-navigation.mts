/** Attribute on the element that holds a set of items (the desktop, a Finder view or column). */
export const itemViewAttributeName = 'data-item-view';

/** Spread onto the element that holds a set of items, so arrow keys stay within it. */
export const itemViewMarker: Readonly<Record<string, string>> = { [itemViewAttributeName]: '' };

/** Attribute on each item's element, holding the item's path. */
export const itemPathAttributeName = 'data-item-path';

/** Which way the arrow keys move the selection. */
export type SelectionMoveDirection = 'previous' | 'next';

/**
 * Translates an arrow key into a selection move: right and down select the next item, left and up
 * the previous one (items are laid out in reading order).
 * @param pressedKey - The key's `key` value.
 * @returns The direction, or undefined for other keys.
 */
export function findSelectionMoveDirection(pressedKey: string): SelectionMoveDirection | undefined {
  if (pressedKey === 'ArrowRight' || pressedKey === 'ArrowDown') {
    return 'next';
  }
  if (pressedKey === 'ArrowLeft' || pressedKey === 'ArrowUp') {
    return 'previous';
  }
  return undefined;
}

/**
 * Finds the item next to an item within the same set of items.
 * @param fromElement - The current item's element.
 * @param direction - Which neighbour to find.
 * @returns The neighbouring item's element, or undefined at either end.
 */
export function findNeighborItemElement(
  fromElement: HTMLElement,
  direction: SelectionMoveDirection,
): HTMLElement | undefined {
  const itemView = fromElement.closest(`[${itemViewAttributeName}]`);
  if (itemView === null) {
    return undefined;
  }
  const itemElements = Array.from(
    itemView.querySelectorAll<HTMLElement>(`[${itemPathAttributeName}]`),
  );
  const currentIndex = itemElements.indexOf(fromElement);
  return itemElements[currentIndex + (direction === 'next' ? 1 : -1)];
}
