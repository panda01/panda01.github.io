import type { JSX } from 'react';
import {
  Box,
  IconButton,
  InputAdornment,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import type { FinderViewMode } from './finder-contents.mts';

/** Props for Finder's toolbar. */
export interface FinderToolbarProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  viewMode: FinderViewMode;
  onViewModeChange: (newViewMode: FinderViewMode) => void;
  searchText: string;
  onSearchTextChange: (newSearchText: string) => void;
}

/**
 * Finder's toolbar: Back and Forward, the icon/list/column view switch, and the search field.
 * @param props - Navigation state, view mode, search text and their handlers.
 * @param props.canGoBack - Whether Back is available.
 * @param props.canGoForward - Whether Forward is available.
 * @param props.onGoBack - Goes back.
 * @param props.onGoForward - Goes forward.
 * @param props.viewMode - The current view.
 * @param props.onViewModeChange - Switches the view.
 * @param props.searchText - The search field's text.
 * @param props.onSearchTextChange - Updates the search text.
 * @returns The toolbar.
 */
export function FinderToolbar({
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  viewMode,
  onViewModeChange,
  searchText,
  onSearchTextChange,
}: FinderToolbarProps): JSX.Element {
  return (
    <Box
      role="toolbar"
      aria-label="Finder toolbar"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        height: 42,
        flexShrink: 0,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex' }}>
        <IconButton size="small" aria-label="Back" disabled={!canGoBack} onClick={onGoBack}>
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          aria-label="Forward"
          disabled={!canGoForward}
          onClick={onGoForward}
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Box>
      <ToggleButtonGroup
        size="small"
        exclusive
        aria-label="View"
        value={viewMode}
        onChange={(_changeEvent, chosenViewMode: FinderViewMode | null) => {
          if (chosenViewMode !== null) {
            onViewModeChange(chosenViewMode);
          }
        }}
        sx={{ '& .MuiToggleButton-root': { px: 1, py: 0.25 } }}
      >
        <ToggleButton value="icons" aria-label="as Icons">
          <GridViewOutlinedIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton value="list" aria-label="as List">
          <ViewListOutlinedIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton value="columns" aria-label="as Columns">
          <ViewColumnOutlinedIcon fontSize="small" />
        </ToggleButton>
      </ToggleButtonGroup>
      <Box sx={{ flex: 1 }} />
      <TextField
        size="small"
        type="search"
        placeholder="Search"
        value={searchText}
        onChange={(changeEvent) => {
          onSearchTextChange(changeEvent.target.value);
        }}
        slotProps={{
          htmlInput: { 'aria-label': 'Search' },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
        sx={{ width: 190, '& .MuiInputBase-input': { py: 0.5, fontSize: 13 } }}
      />
    </Box>
  );
}
