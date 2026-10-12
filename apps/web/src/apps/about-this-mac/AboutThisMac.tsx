import type { JSX } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { useDesktopSession } from '../../system/desktop-session/desktop-session-context.tsx';
import { SystemLogoIcon } from '../../shell/icons/system-icons.tsx';

/**
 * About This Mac: credits and facts about this site, in the style of the macOS window.
 * @returns The window content.
 */
export function AboutThisMac(): JSX.Element {
  const { isStoredInBrowser } = useDesktopSession();
  const storageDescription = isStoredInBrowser
    ? 'Saved in this browser'
    : 'Not saved (this browser blocks site storage)';

  return (
    <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center', p: 3 }}>
      <Box sx={{ color: 'text.primary', lineHeight: 0 }}>
        <SystemLogoIcon size={64} />
      </Box>
      <Typography component="h2" variant="h5" sx={{ fontWeight: 700 }}>
        khalah.com
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        A macOS-style desktop that runs in your browser
      </Typography>
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'auto auto',
          columnGap: 2,
          rowGap: 0.5,
          m: 0,
          fontSize: 12,
          textAlign: 'left',
          '& dt': { color: 'text.secondary', textAlign: 'right' },
          '& dd': { m: 0 },
        }}
      >
        <dt>Version</dt>
        <dd>1.0 (Phase 1)</dd>
        <dt>Storage</dt>
        <dd>{storageDescription}</dd>
        <dt>Built with</dt>
        <dd>React, MUI, Dexie, Zustand, Motion, react-rnd</dd>
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Not affiliated with or endorsed by Apple Inc.
      </Typography>
    </Stack>
  );
}
