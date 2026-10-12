import type { JSX } from 'react';
import { Box } from '@mui/material';

/**
 * The desktop wallpaper: an original soft gradient (no Apple wallpapers), with a darker variant in
 * dark mode.
 * @returns The wallpaper layer.
 */
export function Wallpaper(): JSX.Element {
  return (
    <Box
      data-testid="desktop-wallpaper"
      aria-hidden="true"
      sx={(theme) => ({
        position: 'absolute',
        inset: 0,
        backgroundColor: '#3a4f9a',
        backgroundImage: [
          'radial-gradient(circle at 18% 22%, rgba(255, 170, 120, 0.85), transparent 42%)',
          'radial-gradient(circle at 82% 30%, rgba(120, 200, 255, 0.8), transparent 45%)',
          'radial-gradient(circle at 50% 95%, rgba(170, 110, 255, 0.85), transparent 55%)',
          'linear-gradient(160deg, #4a6fd8 0%, #2b2f77 100%)',
        ].join(', '),
        ...theme.applyStyles('dark', {
          backgroundColor: '#141633',
          backgroundImage: [
            'radial-gradient(circle at 18% 22%, rgba(190, 90, 60, 0.55), transparent 42%)',
            'radial-gradient(circle at 82% 30%, rgba(40, 110, 170, 0.6), transparent 45%)',
            'radial-gradient(circle at 50% 95%, rgba(100, 50, 170, 0.7), transparent 55%)',
            'linear-gradient(160deg, #1d2a5c 0%, #0d0f26 100%)',
          ].join(', '),
        }),
      })}
    />
  );
}
