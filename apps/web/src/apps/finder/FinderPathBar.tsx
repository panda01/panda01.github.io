import type { JSX } from 'react';
import { Box, Breadcrumbs, Link, Typography } from '@mui/material';
import { getFolderDisplayName, listPathAndAncestors } from '../../system/fs/path-utilities.mts';
import { describeItemCount } from './finder-contents.mts';

/** Props for Finder's path bar. */
export interface FinderPathBarProps {
  currentFolderPath: string;
  /** How many items the window shows. */
  itemCount: number;
  onShowFolder: (folderPath: string) => void;
}

/**
 * The bar at the bottom of a Finder window: the path from "Macintosh HD" to the folder shown
 * (click any part to go there) and how many items the window shows.
 * @param props - The folder, item count and navigation handler.
 * @param props.currentFolderPath - The folder shown.
 * @param props.itemCount - How many items are shown.
 * @param props.onShowFolder - Shows a folder in the window.
 * @returns The path bar.
 */
export function FinderPathBar({
  currentFolderPath,
  itemCount,
  onShowFolder,
}: FinderPathBarProps): JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        height: 26,
        px: 1.5,
        flexShrink: 0,
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Breadcrumbs
        aria-label="Path"
        separator="›"
        maxItems={12}
        sx={{ flex: 1, minWidth: 0, fontSize: 12, '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' } }}
      >
        {listPathAndAncestors(currentFolderPath).map((ancestorPath) => (
          <Link
            key={ancestorPath}
            component="button"
            type="button"
            underline="hover"
            color="inherit"
            onClick={() => {
              onShowFolder(ancestorPath);
            }}
            sx={{ fontSize: 12, whiteSpace: 'nowrap' }}
          >
            {getFolderDisplayName(ancestorPath)}
          </Link>
        ))}
      </Breadcrumbs>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>
        {describeItemCount(itemCount)}
      </Typography>
    </Box>
  );
}
