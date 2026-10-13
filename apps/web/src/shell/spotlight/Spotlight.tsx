import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import {
  Autocomplete,
  Box,
  InputAdornment,
  Modal,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { appManifests } from '../../system/app-registry/app-registry.mts';
import {
  useActivateApp,
  useDesktopSession,
} from '../../system/desktop-session/desktop-session-context.tsx';
import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import { chooseItemIconKind } from '../../system/fs/item-presentation.mts';
import { useLiveQueryResult } from '../../system/hooks/use-live-query-result.mts';
import { useItemActions } from '../../system/item-actions/use-item-actions.mts';
import { translucentSurfaceBackdropFilter } from '../../system/theme/desktop-theme.mts';
import { ItemIcon } from '../icons/item-icons.tsx';
import { buildSpotlightEntries, createSpotlightSearch } from './spotlight-search.mts';
import type { SpotlightEntry } from './spotlight-search.mts';
import { useSpotlightStore } from './spotlight-store.mts';

const noItems: readonly FileSystemItem[] = [];

/**
 * Spotlight: a search box floating near the top of the screen that finds applications, files and
 * folders as you type (forgiving small typos). Enter or a click opens the highlighted result:
 * applications launch, folders open in Finder, files open in Quick Look, links open in a new tab.
 * Escape or clicking elsewhere closes it.
 * @returns Spotlight (rendered only while open).
 */
export function Spotlight(): JSX.Element {
  const isSpotlightOpen = useSpotlightStore((spotlightState) => spotlightState.isSpotlightOpen);
  const closeSpotlight = useSpotlightStore((spotlightState) => spotlightState.closeSpotlight);
  return (
    <Modal
      open={isSpotlightOpen}
      onClose={closeSpotlight}
      slotProps={{ backdrop: { invisible: true } }}
    >
      <Paper
        role="dialog"
        aria-label="Spotlight"
        elevation={12}
        sx={(theme) => ({
          position: 'absolute',
          top: '18%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(640px, calc(100vw - 32px))',
          borderRadius: 3,
          p: 1,
          outline: 'none',
          backgroundColor: 'rgba(246, 246, 248, 0.85)',
          backdropFilter: translucentSurfaceBackdropFilter,
          ...theme.applyStyles('dark', { backgroundColor: 'rgba(40, 40, 44, 0.85)' }),
          '@media (prefers-reduced-transparency: reduce)': {
            backdropFilter: 'none',
            backgroundColor: 'background.paper',
          },
        })}
      >
        <SpotlightSearchPanel onClose={closeSpotlight} />
      </Paper>
    </Modal>
  );
}

/**
 * The search field and its results. Mounted only while Spotlight is open, so every opening starts
 * with an empty search.
 * @param props - How to close Spotlight.
 * @param props.onClose - Closes Spotlight.
 * @returns The search panel.
 */
function SpotlightSearchPanel({ onClose }: { onClose: () => void }): JSX.Element {
  const { fileSystem } = useDesktopSession();
  const activateApp = useActivateApp();
  const itemActions = useItemActions();
  const [searchText, setSearchText] = useState('');
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const listAllItems = useCallback(() => fileSystem.listAllItems(), [fileSystem]);
  const { value: allItems } = useLiveQueryResult<readonly FileSystemItem[]>(listAllItems, noItems);
  const searchSpotlight = useMemo(
    () => createSpotlightSearch(buildSpotlightEntries(appManifests, allItems)),
    [allItems],
  );
  const matchingEntries = useMemo(() => searchSpotlight(searchText), [searchSpotlight, searchText]);

  // The search field takes the keyboard as soon as Spotlight opens, ready for typing.
  useEffect(() => {
    searchPanelRef.current?.querySelector('input')?.focus();
  }, []);

  /**
   * Opens a result and closes Spotlight.
   * @param chosenEntry - The chosen result.
   */
  function openEntry(chosenEntry: SpotlightEntry): void {
    onClose();
    if (chosenEntry.kind === 'application') {
      activateApp(chosenEntry.appManifest.id);
    } else {
      itemActions.openItem(chosenEntry.item);
    }
  }

  return (
    <Box ref={searchPanelRef}>
      <Autocomplete
        open={matchingEntries.length > 0}
        options={matchingEntries}
        filterOptions={(alreadyMatchedEntries) => alreadyMatchedEntries}
        getOptionLabel={(spotlightEntry) => spotlightEntry.title}
        getOptionKey={(spotlightEntry) => spotlightEntry.entryKey}
        isOptionEqualToValue={(firstEntry, secondEntry) =>
          firstEntry.entryKey === secondEntry.entryKey
        }
        value={null}
        inputValue={searchText}
        onInputChange={(_inputEvent, typedText, changeReason) => {
          if (changeReason === 'input' || changeReason === 'clear') {
            setSearchText(typedText);
          }
        }}
        onChange={(_changeEvent, chosenEntry) => {
          if (chosenEntry !== null) {
            openEntry(chosenEntry);
          }
        }}
        autoHighlight
        disablePortal
        forcePopupIcon={false}
        renderInput={(inputParameters) => (
          <TextField
            {...inputParameters}
            placeholder="Spotlight Search"
            onKeyDown={(keyboardEvent) => {
              if (keyboardEvent.key === 'Escape') {
                keyboardEvent.preventDefault();
                keyboardEvent.stopPropagation();
                onClose();
              }
            }}
            slotProps={{
              ...inputParameters.slotProps,
              htmlInput: {
                ...inputParameters.slotProps.htmlInput,
                'aria-label': 'Spotlight Search',
              },
              input: {
                ...inputParameters.slotProps.input,
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
              '& .MuiInputBase-input': { fontSize: 20 },
            }}
          />
        )}
        renderOption={(optionProps, spotlightEntry) => {
          const { key: optionKey, ...optionElementProps } = optionProps;
          return (
            <Box component="li" key={optionKey} {...optionElementProps} sx={{ gap: 1.5 }}>
              {spotlightEntry.kind === 'application' ? (
                <spotlightEntry.appManifest.AppIcon size={28} />
              ) : (
                <ItemIcon iconKind={chooseItemIconKind(spotlightEntry.item)} size={28} />
              )}
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>
                  {spotlightEntry.title}
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>
                  {spotlightEntry.subtitle}
                </Typography>
              </Box>
            </Box>
          );
        }}
        slotProps={{
          paper: {
            elevation: 12,
            /**
             * Styles the results like the search panel: translucent, blurred and rounded.
             * @param theme - The desktop theme.
             * @returns The results panel's styles.
             */
            sx: (theme) => ({
              mt: 1,
              borderRadius: 3,
              backgroundColor: 'rgba(246, 246, 248, 0.94)',
              backdropFilter: translucentSurfaceBackdropFilter,
              ...theme.applyStyles('dark', { backgroundColor: 'rgba(40, 40, 44, 0.94)' }),
              '@media (prefers-reduced-transparency: reduce)': {
                backdropFilter: 'none',
                backgroundColor: 'background.paper',
              },
            }),
          },
          listbox: { sx: { maxHeight: 420 } },
        }}
      />
    </Box>
  );
}
