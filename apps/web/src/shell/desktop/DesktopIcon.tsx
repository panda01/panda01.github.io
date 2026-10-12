import type { JSX, MouseEvent } from 'react';
import { Box, ButtonBase } from '@mui/material';
import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import { chooseItemIconKind } from '../../system/fs/item-presentation.mts';
import { ItemIcon } from '../icons/item-icons.tsx';

/** Props for one desktop icon. */
export interface DesktopIconProps {
  item: FileSystemItem;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onOpenContextMenu: (contextMenuEvent: MouseEvent<HTMLElement>) => void;
}

/**
 * One item on the desktop: its icon and name. Click selects it, double-click (or Enter) opens it,
 * and right-click opens its menu.
 * @param props - The item, its selection state and handlers.
 * @param props.item - The file, folder or link shown.
 * @param props.isSelected - Whether the icon is selected.
 * @param props.onSelect - Selects the icon.
 * @param props.onOpen - Opens the item.
 * @param props.onOpenContextMenu - Opens the item's right-click menu.
 * @returns The desktop icon.
 */
export function DesktopIcon({
  item,
  isSelected,
  onSelect,
  onOpen,
  onOpenContextMenu,
}: DesktopIconProps): JSX.Element {
  return (
    <ButtonBase
      aria-label={item.name}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(doubleClickEvent) => {
        doubleClickEvent.stopPropagation();
        onOpen();
      }}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === 'Enter') {
          keyboardEvent.preventDefault();
          onOpen();
        }
      }}
      onContextMenu={(contextMenuEvent) => {
        contextMenuEvent.preventDefault();
        contextMenuEvent.stopPropagation();
        onSelect();
        onOpenContextMenu(contextMenuEvent);
      }}
      sx={{
        width: 92,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        p: 0.5,
        borderRadius: 1.5,
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
      }}
    >
      <Box
        sx={{
          p: 0.5,
          borderRadius: 1.5,
          lineHeight: 0,
          bgcolor: isSelected ? 'rgba(0, 0, 0, 0.25)' : 'transparent',
        }}
      >
        <ItemIcon iconKind={chooseItemIconKind(item)} size={56} />
      </Box>
      <Box
        component="span"
        sx={{
          maxWidth: '100%',
          px: 0.75,
          borderRadius: 1,
          fontSize: 12,
          fontWeight: 500,
          lineHeight: 1.3,
          textAlign: 'center',
          wordBreak: 'break-word',
          color: '#ffffff',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
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
