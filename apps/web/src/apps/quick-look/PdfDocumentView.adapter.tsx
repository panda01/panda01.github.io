import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { CircularProgress, Typography } from '@mui/material';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// pdf.js renders in a web worker; Vite serves the worker file that matches the installed pdf.js.
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** Props for the PDF viewer. */
export interface PdfDocumentViewProps {
  /** The PDF file's bytes. */
  pdfBytes: Uint8Array;
  /** Width of each page in CSS pixels. */
  pageWidth: number;
}

/**
 * Thin wrapper around react-pdf: draws every page of a PDF, one under another, with selectable
 * text and clickable links (opened in a new tab). Kept free of other logic so it can be replaced
 * in unit tests, where PDF rendering is not available.
 *
 * react-pdf 11 loads through React Suspense by default, which restarts the load forever when the
 * PDF bytes are prepared inside the viewer (found in the Phase 2 E2E tests: pdf.js workers were
 * created in a loop and no page appeared). `suspense={false}` uses the `loading` and `error`
 * props below instead, and the memoized bytes stay the same from render to render.
 * @param props - The PDF bytes and page width.
 * @param props.pdfBytes - The PDF file's bytes.
 * @param props.pageWidth - Width of each page.
 * @returns The rendered document.
 */
export function PdfDocumentView({ pdfBytes, pageWidth }: PdfDocumentViewProps): JSX.Element {
  // pdf.js takes ownership of the bytes it is given, so it gets its own copy.
  const pdfFile = useMemo(() => ({ data: new Uint8Array(pdfBytes) }), [pdfBytes]);
  const [pageCount, setPageCount] = useState(0);
  return (
    <Document
      file={pdfFile}
      onLoadSuccess={(loadedDocument) => {
        setPageCount(loadedDocument.numPages);
      }}
      loading={<CircularProgress size={24} aria-label="Loading PDF" />}
      error={<Typography role="alert">This PDF can’t be shown.</Typography>}
      externalLinkTarget="_blank"
      externalLinkRel="noopener noreferrer"
      suspense={false}
    >
      {Array.from({ length: pageCount }, (_, pageIndex) => (
        <Page
          key={pageIndex}
          pageNumber={pageIndex + 1}
          width={pageWidth}
          className="quick-look-pdf-page"
        />
      ))}
    </Document>
  );
}
