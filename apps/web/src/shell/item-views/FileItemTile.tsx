import type { JSX } from 'react';
import { Box, ButtonBase } from '@mui/material';
import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import {
  chooseItemIconKind,
  computeRenameSelectionLength,
} from '../../system/fs/item-presentation.mts';
import { ItemIcon } from '../icons/item-icons.tsx';
import { InlineRenameField } from './InlineRenameField.tsx';
import { useFileItemInteractions } from './use-file-item-interactions.mts';
import type { FileItemInteractionHandlers } from './use-file-item-interactions.mts';

/** Where a tile is drawn: on the wallpaper (white text) or inside a Finder window. */
export type FileItemTileAppearance = 'on-wallpaper' | 'in-window';

/** Props for one icon tile. */
export interface FileItemTileProps extends FileItemInteractionHandlers {
  item: FileSystemItem;
  /** Where the tile is shown (for example "desktop" or a Finder window id). */
  placeId: string;
  appearance: FileItemTileAppearance;
  isSelected: boolean;
  /** Whether the name is being edited. */
  isRenaming: boolean;
  /** Receives the new name when renaming ends, or undefined when it was cancelled. */
  onFinishRenaming: (requestedName: string | undefined) => void;
}

/**
 * An item drawn as a big icon with its name underneath: the desktop's icons and Finder's icon view.
 * It can be selected, opened, previewed with Space, dragged, renamed in place, and (for folders and
 * aliases) have items dropped onto it.
 * @param props - The item, where it is shown, its state and handlers.
 * @param props.item - The file, folder or link.
 * @param props.placeId - Where it is shown.
 * @param props.appearance - Wallpaper or window styling.
 * @param props.isSelected - Whether it is selected.
 * @param props.isRenaming - Whether its name field is open.
 * @param props.onFinishRenaming - Receives the new name.
 * @returns The tile.
 */
export function FileItemTile({
  item,
  placeId,
  appearance,
  isSelected,
  isRenaming,
  onFinishRenaming,
  ...interactionHandlers
}: FileItemTileProps): JSX.Element {
  const {
    dragListeners,
    dropTargetAttributes,
    itemElementProps,
    isBeingDragged,
    isDropHighlighted,
  } = useFileItemInteractions(item, placeId, isRenaming, interactionHandlers);
  const isOnWallpaper = appearance === 'on-wallpaper';
  const isIconHighlighted = isSelected || isDropHighlighted;
  const iconHighlightColor = isOnWallpaper ? 'rgba(0, 0, 0, 0.25)' : 'action.selected';
  const tileLayout = {
    width: 92,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0.5,
    p: 0.5,
    borderRadius: 1.5,
    opacity: isBeingDragged ? 0.4 : 1,
  } as const;
  const icon = (
    <Box
      sx={{
        p: 0.5,
        borderRadius: 1.5,
        lineHeight: 0,
        bgcolor: isIconHighlighted ? iconHighlightColor : 'transparent',
        outline: isDropHighlighted ? '2px solid' : 'none',
        outlineColor: 'primary.main',
      }}
    >
      <ItemIcon iconKind={chooseItemIconKind(item)} size={isOnWallpaper ? 56 : 52} />
    </Box>
  );

  if (isRenaming) {
    return (
      <Box sx={tileLayout}>
        {icon}
        <InlineRenameField
          initialName={item.name}
          selectedCharacterCount={computeRenameSelectionLength(item)}
          onFinish={onFinishRenaming}
        />
      </Box>
    );
  }

  return (
    <ButtonBase
      aria-label={item.name}
      {...dragListeners}
      {...dropTargetAttributes}
      {...itemElementProps}
      sx={{
        ...tileLayout,
        touchAction: 'manipulation',
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
      }}
    >
      {icon}
      <Box
        component="span"
        sx={{
          maxWidth: '100%',
          px: 0.75,
          borderRadius: 1,
          fontSize: 12,
          fontWeight: isOnWallpaper ? 500 : 400,
          lineHeight: 1.3,
          textAlign: 'center',
          wordBreak: 'break-word',
          color: isOnWallpaper || isSelected ? '#ffffff' : 'text.primary',
          textShadow: isOnWallpaper ? '0 1px 2px rgba(0, 0, 0, 0.8)' : 'none',
          bgcolor: isSelected ? 'primary.main' : 'transparent',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {item.name}
      </Box>
    </ButtonBase>
  );
}
