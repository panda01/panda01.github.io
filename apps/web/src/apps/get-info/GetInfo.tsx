import { useCallback } from 'react';
import type { JSX } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import type { AppWindowContentProps } from '../../system/app-registry/app-manifest.types.mts';
import { useDesktopSession } from '../../system/desktop-session/desktop-session-context.tsx';
import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import {
  chooseItemIconKind,
  describeItemKind,
  formatByteSize,
  formatItemTimestamp,
} from '../../system/fs/item-presentation.mts';
import { getParentPath } from '../../system/fs/path-utilities.mts';
import { useLiveQueryResult } from '../../system/hooks/use-live-query-result.mts';
import { ItemIcon } from '../../shell/icons/item-icons.tsx';

/**
 * Lists the facts Get Info shows for an item, in display order.
 * @param describedItem - The item being described.
 * @returns Label/value pairs.
 */
export function buildItemInfoRows(describedItem: FileSystemItem): [string, string][] {
  const infoRows: [string, string][] = [['Kind', describeItemKind(describedItem)]];
  if (describedItem.kind === 'file') {
    infoRows.push(['Size', formatByteSize(describedItem.sizeInBytes)]);
  }
  if (describedItem.linkTarget !== undefined) {
    const linkDestination =
      describedItem.linkTarget.kind === 'url'
        ? describedItem.linkTarget.url
        : describedItem.linkTarget.path;
    infoRows.push(['Points to', linkDestination]);
  }
  infoRows.push(
    ['Where', getParentPath(describedItem.path)],
    ['Created', formatItemTimestamp(describedItem.createdAt)],
    ['Modified', formatItemTimestamp(describedItem.modifiedAt)],
  );
  return infoRows;
}

/**
 * Get Info: details about one file, folder or link. Updates live if the item changes, and says so
 * if it is deleted while the window is open.
 * @param props - Window content props.
 * @param props.launchArgument - Path of the item to describe.
 * @returns The window content.
 */
export function GetInfo({ launchArgument }: AppWindowContentProps): JSX.Element {
  const { fileSystem } = useDesktopSession();
  const describedItemPath = launchArgument ?? '/';
  const findDescribedItem = useCallback(
    () => fileSystem.findItem(describedItemPath),
    [fileSystem, describedItemPath],
  );
  const { value: describedItem, isLoaded } = useLiveQueryResult<FileSystemItem | undefined>(
    findDescribedItem,
    undefined,
  );

  if (!isLoaded) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', p: 4 }}>
        <CircularProgress size={24} aria-label="Loading item information" />
      </Box>
    );
  }
  if (describedItem === undefined) {
    return (
      <Typography role="status" sx={{ p: 3, color: 'text.secondary' }}>
        This item no longer exists.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5} sx={{ p: 2 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <ItemIcon iconKind={chooseItemIconKind(describedItem)} size={48} />
        <Typography
          component="h2"
          variant="subtitle1"
          sx={{ fontWeight: 600, wordBreak: 'break-word' }}
        >
          {describedItem.name}
        </Typography>
      </Stack>
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          columnGap: 1.5,
          rowGap: 0.75,
          m: 0,
          fontSize: 12,
          '& dt': { color: 'text.secondary', textAlign: 'right' },
          '& dd': { m: 0, wordBreak: 'break-word' },
        }}
      >
        {buildItemInfoRows(describedItem).map(([infoLabel, infoValue]) => (
          <Box key={infoLabel} sx={{ display: 'contents' }}>
            <dt>{infoLabel}:</dt>
            <dd>{infoValue}</dd>
          </Box>
        ))}
      </Box>
    </Stack>
  );
}
