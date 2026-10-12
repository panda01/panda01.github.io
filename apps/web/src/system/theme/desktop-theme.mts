import { createTheme } from '@mui/material';
import type { Theme } from '@mui/material';

/**
 * Font stack: visitors on Apple devices get their own system font (SF, licensed to them by Apple);
 * everyone else gets the bundled Inter. SF Pro itself is never shipped by this site.
 */
export const desktopFontStack =
  '-apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Arial, sans-serif';

/** Blur used for translucent surfaces (menu bar, menus, Dock); turned off for reduced transparency. */
export const translucentSurfaceBackdropFilter = 'blur(24px) saturate(180%)';

/**
 * Builds the MUI theme with macOS-like light and dark colour schemes. The scheme follows the
 * visitor's system setting (`prefers-color-scheme`) through CSS variables.
 * @returns The desktop theme.
 */
export function createDesktopTheme(): Theme {
  return createTheme({
    cssVariables: { colorSchemeSelector: 'media' },
    colorSchemes: {
      light: {
        palette: {
          primary: { main: '#0a64d6' },
          error: { main: '#d93025' },
          background: { default: '#eceef2', paper: '#f6f6f8' },
          text: { primary: '#1d1d1f', secondary: '#5f6368' },
        },
      },
      dark: {
        palette: {
          primary: { main: '#3d8df5' },
          error: { main: '#ff6961' },
          background: { default: '#1c1c1e', paper: '#2a2a2e' },
          text: { primary: '#f5f5f7', secondary: '#a1a1a6' },
        },
      },
    },
    typography: {
      fontFamily: desktopFontStack,
      fontSize: 13,
      button: { textTransform: 'none', fontWeight: 500 },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiButtonBase: { defaultProps: { disableRipple: true } },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backdropFilter: translucentSurfaceBackdropFilter,
            minWidth: 220,
            '@media (prefers-reduced-transparency: reduce)': { backdropFilter: 'none' },
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: { root: { fontSize: 13, minHeight: 26, borderRadius: 5, margin: '0 5px' } },
      },
    },
  });
}
