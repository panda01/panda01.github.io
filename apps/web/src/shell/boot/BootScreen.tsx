import type { JSX } from 'react';
import { Box, LinearProgress } from '@mui/material';
import { SystemLogoIcon } from '../icons/system-icons.tsx';

/**
 * The start-up screen: the site's logo and a progress bar on black, shown while the desktop loads
 * (and while it is being reset).
 * @returns The boot screen.
 */
export function BootScreen(): JSX.Element {
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        bgcolor: '#000000',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
      }}
    >
      <SystemLogoIcon size={88} />
      <LinearProgress
        aria-label="Starting up"
        sx={{
          width: 200,
          height: 5,
          borderRadius: 3,
          bgcolor: 'rgba(255, 255, 255, 0.25)',
          '& .MuiLinearProgress-bar': { bgcolor: '#ffffff' },
        }}
      />
    </Box>
  );
}
