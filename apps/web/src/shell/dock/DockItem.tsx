import { useRef } from 'react';
import type { JSX, KeyboardEvent, MouseEvent, ReactNode, Ref } from 'react';
import { Box } from '@mui/material';
import { motion, useSpring, useTransform } from 'motion/react';
import type { MotionValue } from 'motion/react';
import {
  computeMagnifiedIconSize,
  defaultDockMagnificationSettings,
} from './dock-magnification.mts';

/** Props for one Dock icon. */
export interface DockItemProps {
  /** Name shown in the hover label (and used as the accessible name unless overridden). */
  label: string;
  /** Accessible name when it should differ from the label, for example "Notes (minimized)". */
  accessibleName?: string;
  icon: ReactNode;
  /** Horizontal pointer position over the Dock (Infinity when the pointer is elsewhere). */
  pointerX: MotionValue<number>;
  /** For app icons: whether the app is running (shows the dot). Omit for other items. */
  isRunning?: boolean;
  /** Whether to play the launch bounce. */
  isBouncing?: boolean;
  /** 0 for the one item reachable with Tab, -1 for the others (roving tabindex). */
  tabIndex: number;
  buttonRef: Ref<HTMLButtonElement>;
  onClick: () => void;
  onContextMenu?: (contextMenuEvent: MouseEvent<HTMLButtonElement>) => void;
  onKeyDown: (keyboardEvent: KeyboardEvent<HTMLButtonElement>) => void;
}

/**
 * One Dock icon. It grows as the pointer approaches (macOS magnification), shows its name above it
 * on hover or keyboard focus, shows a dot when its app is running, and bounces when launched.
 * @param props - The item's label, icon, state and handlers.
 * @param props.label - Name shown in the hover label.
 * @param props.accessibleName - Accessible name override.
 * @param props.icon - The icon artwork.
 * @param props.pointerX - Pointer position over the Dock.
 * @param props.isRunning - Whether the app is running (apps only).
 * @param props.isBouncing - Whether to play the launch bounce.
 * @param props.tabIndex - Roving tabindex value.
 * @param props.buttonRef - Ref to the button, used by the Dock to move keyboard focus.
 * @param props.onClick - Activates the item.
 * @param props.onContextMenu - Opens the item's menu.
 * @param props.onKeyDown - Handles arrow-key navigation.
 * @returns The Dock item.
 */
export function DockItem({
  label,
  accessibleName,
  icon,
  pointerX,
  isRunning,
  isBouncing = false,
  tabIndex,
  buttonRef,
  onClick,
  onContextMenu,
  onKeyDown,
}: DockItemProps): JSX.Element {
  const measuringElementRef = useRef<HTMLDivElement>(null);
  const magnifiedSize = useTransform(pointerX, (pointerPosition) => {
    const itemBox = measuringElementRef.current?.getBoundingClientRect();
    if (itemBox === undefined) {
      return defaultDockMagnificationSettings.restingIconSize;
    }
    return computeMagnifiedIconSize(pointerPosition - (itemBox.left + itemBox.width / 2));
  });
  const springySize = useSpring(magnifiedSize, { mass: 0.1, stiffness: 220, damping: 16 });

  return (
    <Box
      ref={measuringElementRef}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        '&:hover .dock-item-label, &:focus-within .dock-item-label': { opacity: 1 },
      }}
    >
      <Box
        className="dock-item-label"
        aria-hidden="true"
        sx={{
          position: 'absolute',
          bottom: '100%',
          mb: 1.5,
          px: 1.25,
          py: 0.5,
          borderRadius: 1,
          fontSize: 12,
          whiteSpace: 'nowrap',
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: 3,
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 120ms',
        }}
      >
        {label}
      </Box>
      <motion.button
        ref={buttonRef}
        type="button"
        aria-label={accessibleName ?? label}
        data-running={isRunning === undefined ? undefined : String(isRunning)}
        tabIndex={tabIndex}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onKeyDown={onKeyDown}
        animate={isBouncing ? { y: [0, -18, 0, -8, 0] } : { y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{
          width: springySize,
          height: springySize,
          padding: 0,
          border: 'none',
          background: 'none',
          cursor: 'default',
          display: 'block',
        }}
      >
        <Box sx={{ width: '100%', height: '100%', '& svg': { width: '100%', height: '100%' } }}>
          {icon}
        </Box>
      </motion.button>
      <Box
        aria-hidden="true"
        sx={{
          width: 4,
          height: 4,
          mt: '3px',
          borderRadius: '50%',
          bgcolor: 'text.primary',
          visibility: isRunning === true ? 'visible' : 'hidden',
        }}
      />
    </Box>
  );
}
