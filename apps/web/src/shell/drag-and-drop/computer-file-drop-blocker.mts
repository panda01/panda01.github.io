/** The native drag events that could bring a file in from the visitor's computer. */
const nativeDragEventNames = ['dragenter', 'dragover', 'drop'] as const;

/**
 * Reports whether a native drag might be carrying files from the visitor's computer. A drag whose
 * contents the browser does not reveal is treated as possibly carrying files.
 * @param dataTransfer - The drag's data, if the browser provides it.
 * @returns True when the drag carries (or may carry) files.
 */
export function isDragFromComputerFiles(dataTransfer: DataTransfer | null): boolean {
  return dataTransfer === null || dataTransfer.types.includes('Files');
}

/**
 * Refuses files dragged in from the visitor's computer: visitors cannot upload anything. The
 * browser's default for a dropped file is to leave the site and open the file, so these drags are
 * cancelled (and shown as "not allowed") everywhere on the page. The desktop's own drag-and-drop
 * uses pointer events, not native drags, so it is unaffected; dragging text into a text field still
 * works.
 * @param eventTarget - Where to listen (the page's window).
 * @returns A function that stops blocking.
 */
export function blockFileDropsFromComputer(eventTarget: EventTarget): () => void {
  /**
   * Cancels one native drag event when it carries files.
   * @param dragEvent - The drag event.
   */
  function refuseComputerFiles(dragEvent: Event): void {
    // Checked by property rather than `instanceof DragEvent`, which not every environment defines.
    const dataTransfer = 'dataTransfer' in dragEvent ? (dragEvent as DragEvent).dataTransfer : null;
    if (!isDragFromComputerFiles(dataTransfer)) {
      return;
    }
    dragEvent.preventDefault();
    if (dataTransfer !== null) {
      dataTransfer.dropEffect = 'none';
    }
  }

  for (const nativeDragEventName of nativeDragEventNames) {
    eventTarget.addEventListener(nativeDragEventName, refuseComputerFiles);
  }
  return () => {
    for (const nativeDragEventName of nativeDragEventNames) {
      eventTarget.removeEventListener(nativeDragEventName, refuseComputerFiles);
    }
  };
}
