import type { JSX } from 'react';
import { Box, ButtonBase } from '@mui/material';

/** Class on each traffic-light button; window dragging ignores presses that start on them. */
export const trafficLightClassName = 'window-traffic-light';

/** Props for the three window buttons. */
export interface TrafficLightsProps {
  /** Whether the window is focused; unfocused windows show grey buttons, like macOS. */
  isWindowFocused: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onZoom: () => void;
}

const trafficLightColors = {
  close: '#ff5f57',
  minimize: '#febc2e',
  zoom: '#28c840',
} as const;

/**
 * The red, yellow and green window buttons (close, minimize, zoom). Their symbols appear when the
 * pointer is over the group, as on macOS.
 * @param props - Focus state and button actions.
 * @param props.isWindowFocused - Whether the window is focused.
 * @param props.onClose - Closes the window.
 * @param props.onMinimize - Minimizes the window into the Dock.
 * @param props.onZoom - Zooms or un-zooms the window.
 * @returns The three buttons.
 */
export function TrafficLights({
  isWindowFocused,
  onClose,
  onMinimize,
  onZoom,
}: TrafficLightsProps): JSX.Element {
  const trafficLightButtons = [
    { label: 'Close', symbol: '×', color: trafficLightColors.close, onPress: onClose },
    { label: 'Minimize', symbol: '−', color: trafficLightColors.minimize, onPress: onMinimize },
    { label: 'Zoom', symbol: '+', color: trafficLightColors.zoom, onPress: onZoom },
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        gap: '8px',
        '&:hover .traffic-light-symbol': { opacity: 1 },
      }}
    >
      {trafficLightButtons.map((trafficLightButton) => (
        <ButtonBase
          key={trafficLightButton.label}
          className={trafficLightClassName}
          aria-label={trafficLightButton.label}
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
            trafficLightButton.onPress();
          }}
          onDoubleClick={(doubleClickEvent) => {
            doubleClickEvent.stopPropagation();
          }}
          sx={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            bgcolor: isWindowFocused ? trafficLightButton.color : 'action.disabled',
            border: '0.5px solid rgba(0, 0, 0, 0.2)',
            fontSize: 10,
            lineHeight: 1,
            color: 'rgba(0, 0, 0, 0.6)',
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: 2,
            },
          }}
        >
          <Box
            component="span"
            aria-hidden="true"
            className="traffic-light-symbol"
            sx={{ opacity: 0 }}
          >
            {trafficLightButton.symbol}
          </Box>
        </ButtonBase>
      ))}
    </Box>
  );
}
