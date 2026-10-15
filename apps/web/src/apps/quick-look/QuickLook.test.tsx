import { act, fireEvent, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aboutThisMacAppId,
  buildOpenWindowRequest,
  findAppManifest,
  quickLookAppId,
} from '../../system/app-registry/app-registry.mts';
import type { DesktopSession } from '../../system/desktop-session/desktop-session.mts';
import {
  addTestFolderAliasToDesktop,
  endTestDesktopSession,
  renderInDesktopSession,
  startTestDesktopSession,
} from '../../test-support/desktop-test-session.tsx';
import { buildContentVersionKey, createDataUrl, decodeTextContent } from './quick-look-content.mts';
import { QuickLook } from './QuickLook.tsx';

// PDF rendering needs a real browser; the thin react-pdf wrapper is replaced by a stand-in that
// shows what it was given.
vi.mock('./PdfDocumentView.adapter.tsx', () => ({
  /**
   * Stand-in for the PDF viewer.
   * @param props - The PDF bytes and page width.
   * @param props.pdfBytes - The PDF bytes.
   * @param props.pageWidth - The page width.
   * @returns A description of what would be drawn.
   */
  PdfDocumentView: ({ pdfBytes, pageWidth }: { pdfBytes: Uint8Array; pageWidth: number }) => (
    <div data-testid="pdf-document-view">{`${String(pdfBytes.length)} bytes at ${String(pageWidth)}px`}</div>
  ),
}));

/** Reports every observed element as 600px wide (jsdom has no layout to measure). */
class ResizeObserverReportingFixedWidth implements ResizeObserver {
  /**
   * Remembers whom to tell about sizes.
   * @param reportSizes - The observer's callback.
   */
  constructor(private readonly reportSizes: ResizeObserverCallback) {}

  /**
   * Reports the fixed width straight away.
   */
  observe(): void {
    this.reportSizes([{ contentRect: { width: 600 } } as ResizeObserverEntry], this);
  }

  /**
   * Stops observing one element; nothing to do.
   */
  unobserve(): void {
    // Nothing is being tracked.
  }

  /**
   * Stops observing; nothing to do.
   */
  disconnect(): void {
    // Nothing is being tracked.
  }
}

let desktopSession: DesktopSession;

beforeEach(async () => {
  desktopSession = await startTestDesktopSession();
  vi.stubGlobal('ResizeObserver', ResizeObserverReportingFixedWidth);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await endTestDesktopSession(desktopSession);
});

/**
 * Opens the Quick Look window on an item and renders its content.
 * @param itemPath - The item to preview.
 * @returns The Quick Look window's id.
 */
function renderQuickLook(itemPath: string): string {
  const quickLookManifest = findAppManifest(quickLookAppId);
  if (quickLookManifest === undefined) {
    throw new Error('Quick Look is not registered.');
  }
  let windowId = '';
  act(() => {
    windowId = desktopSession.windowManagerStore
      .getState()
      .openWindow(buildOpenWindowRequest(quickLookManifest, itemPath));
  });
  renderInDesktopSession(
    <QuickLook windowId={windowId} launchArgument={itemPath} />,
    desktopSession,
  );
  return windowId;
}

/**
 * Reports whether a window is still open.
 * @param windowId - The window.
 * @returns True when it is open.
 */
function isWindowOpen(windowId: string): boolean {
  return desktopSession.windowManagerStore.getState().windowsById[windowId] !== undefined;
}

describe('Quick Look previews', () => {
  it('shows a loading state, then a text file’s text', async () => {
    renderQuickLook('/Users/guest/Desktop/About Me.txt');

    expect(screen.getByRole('progressbar', { name: 'Loading preview' })).toBeInTheDocument();
    expect(await screen.findByText('test content for Desktop/About Me.txt')).toBeInTheDocument();
  });

  it('shows an image', async () => {
    await desktopSession.fileSystem.writeFile(
      '/Users/guest/Documents/Red.png',
      new Uint8Array([137, 80, 78, 71]),
      'image/png',
    );
    renderQuickLook('/Users/guest/Documents/Red.png');

    const imagePreview = await screen.findByRole('img', { name: 'Red.png' });
    expect(imagePreview.getAttribute('src')).toBe('data:image/png;base64,iVBORw==');
  });

  it('shows a PDF fitted to the window', async () => {
    renderQuickLook('/Users/guest/Desktop/Resume.pdf');

    expect(await screen.findByTestId('pdf-document-view')).toHaveTextContent(
      `${String('test content for Desktop/Resume.pdf'.length)} bytes at 568px`,
    );
  });

  it('summarises folders, links and unknown files', async () => {
    await desktopSession.fileSystem.writeFile(
      '/Users/guest/Documents/data.bin',
      new Uint8Array([1, 2, 3]),
    );

    renderQuickLook('/Users/guest/Documents/data.bin');
    expect(await screen.findByText('Document – 3 bytes')).toBeInTheDocument();
  });

  it('shows where links point', async () => {
    renderQuickLook('/Users/guest/Desktop/GitHub');
    expect(await screen.findByText('https://github.com/panda01')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });

  it('describes folders and aliases', async () => {
    await addTestFolderAliasToDesktop(desktopSession);
    renderQuickLook('/Users/guest/Desktop/Work');
    expect(await screen.findByText('/Users/guest/Work')).toBeInTheDocument();
    expect(screen.getByText('Alias')).toBeInTheDocument();
  });

  it('says when the item no longer exists', async () => {
    renderQuickLook('/Users/guest/Desktop/Gone.txt');
    expect(await screen.findByText('This item no longer exists.')).toBeInTheDocument();
  });

  it('downloads the previewed file', async () => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(vi.fn());
    renderQuickLook('/Users/guest/Desktop/About Me.txt');

    await userEvent.click(await screen.findByRole('button', { name: 'Download' }));

    await vi.waitFor(() => {
      expect(clickSpy).toHaveBeenCalledOnce();
    });
  });
});

describe('closing Quick Look with Escape', () => {
  it('closes while it is the front window', async () => {
    const quickLookWindowId = renderQuickLook('/Users/guest/Desktop/About Me.txt');
    await screen.findByText('test content for Desktop/About Me.txt');

    act(() => {
      fireEvent.keyDown(document.body, { key: 'Escape' });
    });

    expect(isWindowOpen(quickLookWindowId)).toBe(false);
  });

  it('stays open when another window is in front, while typing, or when Escape was handled', async () => {
    const quickLookWindowId = renderQuickLook('/Users/guest/Desktop/About Me.txt');
    await screen.findByText('test content for Desktop/About Me.txt');
    const textField = document.createElement('input');
    document.body.append(textField);

    act(() => {
      fireEvent.keyDown(textField, { key: 'Escape' });
      const handledEscape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      handledEscape.preventDefault();
      document.body.dispatchEvent(handledEscape);
      fireEvent.keyDown(document.body, { key: 'Enter' });
    });
    expect(isWindowOpen(quickLookWindowId)).toBe(true);

    act(() => {
      desktopSession.windowManagerStore.getState().openWindow({
        appId: aboutThisMacAppId,
        title: 'About This Mac',
        defaultSize: { width: 400, height: 300 },
        allowsMultipleWindows: false,
      });
      fireEvent.keyDown(document.body, { key: 'Escape' });
    });
    expect(isWindowOpen(quickLookWindowId)).toBe(true);
    textField.remove();
  });
});

describe('Quick Look content helpers', () => {
  it('decodes text, builds image addresses in chunks, and keys content versions', () => {
    expect(decodeTextContent(new TextEncoder().encode('héllo'))).toBe('héllo');
    const largeImageBytes = new Uint8Array(0x8000 * 2 + 3).fill(65);
    expect(createDataUrl(largeImageBytes, 'image/gif')).toBe(
      `data:image/gif;base64,${btoa('A'.repeat(largeImageBytes.length))}`,
    );
    expect(
      buildContentVersionKey({
        id: 'a',
        parentId: 'p',
        name: 'a.txt',
        path: '/a.txt',
        kind: 'file',
        mimeType: 'text/plain',
        sizeInBytes: 5,
        createdAt: 1,
        modifiedAt: 2,
      }),
    ).toBe('a:2:5');
  });
});
