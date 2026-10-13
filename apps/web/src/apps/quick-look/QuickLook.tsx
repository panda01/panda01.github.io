import { Suspense, lazy, useCallback, useEffect, useMemo } from 'react';
import type { JSX } from 'react';
import { Box, CircularProgress, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import type { AppWindowContentProps } from '../../system/app-registry/app-manifest.types.mts';
import { useDesktopSession } from '../../system/desktop-session/desktop-session-context.tsx';
import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import {
  chooseItemIconKind,
  chooseQuickLookPreviewKind,
  describeItemKind,
  formatByteSize,
} from '../../system/fs/item-presentation.mts';
import { useElementWidth } from '../../system/hooks/use-element-width.mts';
import { useLiveQueryResult } from '../../system/hooks/use-live-query-result.mts';
import { useValueStableForKey } from '../../system/hooks/use-value-stable-for-key.mts';
import { useItemActions } from '../../system/item-actions/use-item-actions.mts';
import { isTextEntryTarget } from '../../system/keyboard/desktop-keyboard-shortcuts.mts';
import { selectFocusedWindow } from '../../system/window-manager/window-manager-store.mts';
import { ItemIcon } from '../../shell/icons/item-icons.tsx';
import { buildContentVersionKey, createDataUrl, decodeTextContent } from './quick-look-content.mts';

/** The PDF viewer, loaded only when a PDF is first previewed (react-pdf and pdf.js are large). */
const LazyPdfDocumentView = lazy(async () => {
  const { PdfDocumentView } = await import('./PdfDocumentView.adapter.tsx');
  return { default: PdfDocumentView };
});

/** Empty bytes, shown for files whose content is missing. */
const noContent = new Uint8Array();

/** Space left around PDF pages, in CSS pixels. */
const pdfPageMargin = 32;

/**
 * Quick Look: a preview of one item. Text files show their text, images show the picture, PDFs
 * show every page (with selectable text and working links), and anything else shows a summary.
 * Files can be downloaded from here. Escape closes the preview while it is the front window.
 * @param props - Window content props.
 * @param props.windowId - The Quick Look window.
 * @param props.launchArgument - Path of the previewed item.
 * @returns The preview.
 */
export function QuickLook({ windowId, launchArgument }: AppWindowContentProps): JSX.Element {
  const { fileSystem, windowManagerStore } = useDesktopSession();
  const itemActions = useItemActions();
  const previewedItemPath = launchArgument ?? '/';
  const findPreviewedItem = useCallback(
    () => fileSystem.findItem(previewedItemPath),
    [fileSystem, previewedItemPath],
  );
  const { value: previewedItem, isLoaded } = useLiveQueryResult<FileSystemItem | undefined>(
    findPreviewedItem,
    undefined,
  );

  useEffect(() => {
    /**
     * Closes Quick Look on Escape, unless the visitor is typing or another window is in front.
     * @param keyboardEvent - The key press.
     */
    function closeOnEscape(keyboardEvent: KeyboardEvent): void {
      const isEscapeForQuickLook =
        keyboardEvent.key === 'Escape' &&
        !keyboardEvent.defaultPrevented &&
        !isTextEntryTarget(keyboardEvent.target) &&
        selectFocusedWindow(windowManagerStore.getState())?.id === windowId;
      if (isEscapeForQuickLook) {
        keyboardEvent.preventDefault();
        windowManagerStore.getState().closeWindow(windowId);
      }
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [windowId, windowManagerStore]);

  if (!isLoaded) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', p: 4 }}>
        <CircularProgress size={24} aria-label="Loading preview" />
      </Box>
    );
  }
  if (previewedItem === undefined) {
    return (
      <Typography role="status" sx={{ p: 3, color: 'text.secondary' }}>
        This item no longer exists.
      </Typography>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {previewedItem.kind === 'file' ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            px: 1,
            py: 0.25,
            flexShrink: 0,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Tooltip title="Download">
            <IconButton
              size="small"
              aria-label="Download"
              onClick={() => {
                itemActions.runItemMenuAction('download', previewedItem);
              }}
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ) : null}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <QuickLookPreview previewedItem={previewedItem} />
      </Box>
    </Box>
  );
}

/**
 * Chooses and shows the right preview for an item.
 * @param props - The item.
 * @param props.previewedItem - The item to preview.
 * @returns The preview.
 */
function QuickLookPreview({ previewedItem }: { previewedItem: FileSystemItem }): JSX.Element {
  const stableContent = useValueStableForKey(
    previewedItem.content ?? noContent,
    buildContentVersionKey(previewedItem),
  );
  switch (chooseQuickLookPreviewKind(previewedItem)) {
    case 'text':
      return <TextFilePreview fileContent={stableContent} />;
    case 'image':
      return (
        <ImageFilePreview
          fileContent={stableContent}
          mimeType={previewedItem.mimeType}
          imageName={previewedItem.name}
        />
      );
    case 'pdf':
      return <PdfFilePreview fileContent={stableContent} />;
    case 'summary':
      return <ItemSummaryPreview previewedItem={previewedItem} />;
  }
}

/**
 * Shows a text file's text.
 * @param props - The file's bytes.
 * @param props.fileContent - The file's bytes.
 * @returns The text preview.
 */
function TextFilePreview({ fileContent }: { fileContent: Uint8Array }): JSX.Element {
  const fileText = useMemo(() => decodeTextContent(fileContent), [fileContent]);
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 2,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 12.5,
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {fileText}
    </Box>
  );
}

/**
 * Shows an image, scaled down to fit.
 * @param props - The image's bytes, type and name.
 * @param props.fileContent - The image's bytes.
 * @param props.mimeType - The image's type.
 * @param props.imageName - The file name, used as the image's text alternative.
 * @returns The image preview.
 */
function ImageFilePreview({
  fileContent,
  mimeType,
  imageName,
}: {
  fileContent: Uint8Array;
  mimeType: string;
  imageName: string;
}): JSX.Element {
  const imageUrl = useMemo(() => createDataUrl(fileContent, mimeType), [fileContent, mimeType]);
  return (
    <Box
      sx={{ height: '100%', display: 'grid', placeItems: 'center', p: 2, boxSizing: 'border-box' }}
    >
      <Box
        component="img"
        src={imageUrl}
        alt={imageName}
        sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', imageRendering: 'auto' }}
      />
    </Box>
  );
}

/**
 * Shows a PDF's pages, fitted to the window's width.
 * @param props - The PDF's bytes.
 * @param props.fileContent - The PDF's bytes.
 * @returns The PDF preview.
 */
function PdfFilePreview({ fileContent }: { fileContent: Uint8Array }): JSX.Element {
  const [setMeasuredElement, availableWidth] = useElementWidth();
  return (
    <Box
      ref={setMeasuredElement}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        py: 2,
        bgcolor: 'action.hover',
        minHeight: '100%',
        boxSizing: 'border-box',
        '& .quick-look-pdf-page': { boxShadow: 3, mb: 2 },
      }}
    >
      {availableWidth === undefined ? null : (
        <Suspense fallback={<CircularProgress size={24} aria-label="Loading PDF viewer" />}>
          <LazyPdfDocumentView
            pdfBytes={fileContent}
            pageWidth={Math.max(availableWidth - pdfPageMargin, 120)}
          />
        </Suspense>
      )}
    </Box>
  );
}

/**
 * Summarises an item that has no visual preview (folders, links, unknown file types).
 * @param props - The item.
 * @param props.previewedItem - The item.
 * @returns The summary.
 */
function ItemSummaryPreview({ previewedItem }: { previewedItem: FileSystemItem }): JSX.Element {
  const linkDestination =
    previewedItem.linkTarget?.kind === 'url'
      ? previewedItem.linkTarget.url
      : previewedItem.linkTarget?.path;
  return (
    <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center', p: 4 }}>
      <ItemIcon iconKind={chooseItemIconKind(previewedItem)} size={128} />
      <Typography component="h2" variant="h6" sx={{ wordBreak: 'break-word' }}>
        {previewedItem.name}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {describeItemKind(previewedItem)}
        {previewedItem.kind === 'file' ? ` – ${formatByteSize(previewedItem.sizeInBytes)}` : ''}
      </Typography>
      {linkDestination === undefined ? null : (
        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
          {linkDestination}
        </Typography>
      )}
    </Stack>
  );
}
