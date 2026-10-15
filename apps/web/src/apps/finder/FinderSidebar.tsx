import type { ComponentType, JSX } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
} from '@mui/material';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import DesktopMacOutlinedIcon from '@mui/icons-material/DesktopMacOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import type { SvgIconProps } from '@mui/material';
import {
  desktopFolderPath,
  homeFolderPath,
  normalizePath,
  trashFolderPath,
} from '../../system/fs/path-utilities.mts';
import type { FileDropDestination } from '../../system/item-actions/item-actions.mts';
import { useFileDropTarget } from '../../shell/drag-and-drop/use-file-drag-and-drop.mts';

/** One place listed in Finder's sidebar. */
export interface FinderSidebarLocation {
  label: string;
  folderPath: string;
  LocationIcon: ComponentType<SvgIconProps>;
}

/** The sidebar's favourite folders, top to bottom. */
export const finderFavoriteLocations: readonly FinderSidebarLocation[] = [
  { label: 'Desktop', folderPath: desktopFolderPath, LocationIcon: DesktopMacOutlinedIcon },
  {
    label: 'Documents',
    folderPath: `${homeFolderPath}/Documents`,
    LocationIcon: DescriptionOutlinedIcon,
  },
  {
    label: 'Downloads',
    folderPath: `${homeFolderPath}/Downloads`,
    LocationIcon: FileDownloadOutlinedIcon,
  },
];

/** The Trash, listed below the favourites. */
export const finderTrashLocation: FinderSidebarLocation = {
  label: 'Trash',
  folderPath: trashFolderPath,
  LocationIcon: DeleteOutlinedIcon,
};

/** Props for Finder's sidebar. */
export interface FinderSidebarProps {
  windowId: string;
  currentFolderPath: string;
  onShowFolder: (folderPath: string) => void;
}

/**
 * Finder's sidebar: favourite folders and the Trash. Clicking one shows it in the window; dragging
 * an item onto one moves it there (or into the Trash).
 * @param props - The window, the folder shown, and the navigation handler.
 * @param props.windowId - The Finder window.
 * @param props.currentFolderPath - The folder shown now (its entry is highlighted).
 * @param props.onShowFolder - Shows a folder in the window.
 * @returns The sidebar.
 */
export function FinderSidebar({
  windowId,
  currentFolderPath,
  onShowFolder,
}: FinderSidebarProps): JSX.Element {
  return (
    <Box
      component="nav"
      aria-label="Sidebar"
      sx={(theme) => ({
        width: 168,
        flexShrink: 0,
        overflowY: 'auto',
        borderRight: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'rgba(232, 232, 237, 0.7)',
        ...theme.applyStyles('dark', { backgroundColor: 'rgba(44, 44, 48, 0.7)' }),
      })}
    >
      <List dense subheader={<FinderSidebarHeading text="Favorites" />}>
        {finderFavoriteLocations.map((favoriteLocation) => (
          <FinderSidebarEntry
            key={favoriteLocation.folderPath}
            windowId={windowId}
            location={favoriteLocation}
            isCurrentFolder={normalizePath(currentFolderPath) === favoriteLocation.folderPath}
            onShowFolder={onShowFolder}
          />
        ))}
      </List>
      <List dense subheader={<FinderSidebarHeading text="Locations" />}>
        <FinderSidebarEntry
          windowId={windowId}
          location={finderTrashLocation}
          isCurrentFolder={normalizePath(currentFolderPath) === finderTrashLocation.folderPath}
          onShowFolder={onShowFolder}
        />
      </List>
    </Box>
  );
}

/**
 * A sidebar section heading.
 * @param props - The heading text.
 * @param props.text - The text.
 * @returns The heading.
 */
function FinderSidebarHeading({ text }: { text: string }): JSX.Element {
  return (
    <ListSubheader
      disableSticky
      sx={{
        bgcolor: 'transparent',
        lineHeight: '24px',
        fontSize: 11,
        fontWeight: 600,
        color: 'text.secondary',
      }}
    >
      {text}
    </ListSubheader>
  );
}

/**
 * One sidebar entry, which is also a drop target.
 * @param props - The window, the location, whether it is shown, and the navigation handler.
 * @param props.windowId - The Finder window.
 * @param props.location - The location.
 * @param props.isCurrentFolder - Whether the window shows this location.
 * @param props.onShowFolder - Shows a folder in the window.
 * @returns The entry.
 */
function FinderSidebarEntry({
  windowId,
  location,
  isCurrentFolder,
  onShowFolder,
}: {
  windowId: string;
  location: FinderSidebarLocation;
  isCurrentFolder: boolean;
  onShowFolder: (folderPath: string) => void;
}): JSX.Element {
  const dropDestination: FileDropDestination =
    location.folderPath === trashFolderPath
      ? { kind: 'trash' }
      : { kind: 'folder', folderPath: location.folderPath };
  const { setDropNodeRef, dropTargetAttributes, isDropHighlighted } = useFileDropTarget(
    `${windowId}:sidebar`,
    dropDestination,
  );
  const { LocationIcon } = location;
  return (
    <ListItem disablePadding>
      <ListItemButton
        ref={setDropNodeRef}
        {...dropTargetAttributes}
        selected={isCurrentFolder}
        onClick={() => {
          onShowFolder(location.folderPath);
        }}
        sx={{
          mx: 1,
          py: 0.25,
          borderRadius: 1.5,
          outline: isDropHighlighted ? '2px solid' : 'none',
          outlineColor: 'primary.main',
        }}
      >
        <ListItemIcon sx={{ minWidth: 28, color: 'primary.main' }}>
          <LocationIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={location.label} slotProps={{ primary: { sx: { fontSize: 13 } } }} />
      </ListItemButton>
    </ListItem>
  );
}
