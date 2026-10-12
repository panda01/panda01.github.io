/** MIME type used for folders. */
export const folderMimeType = 'inode/directory';

/** MIME type used for links (web links and aliases). */
export const linkMimeType = 'application/x-link';

/** MIME type used when a file's type cannot be guessed from its name. */
export const unknownFileMimeType = 'application/octet-stream';

const mimeTypesByExtension: Readonly<Record<string, string>> = {
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  csv: 'text/csv',
  json: 'application/json',
  js: 'text/javascript',
  ts: 'text/plain',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

/**
 * Splits a file name into the part before its extension and the extension itself, macOS-style:
 * a leading dot (hidden files like `.Trash`) is not treated as an extension separator.
 * @param fileName - The file name, for example "About Me.txt".
 * @returns The stem ("About Me") and the extension including its dot (".txt"), or an empty extension.
 */
export function splitNameAndExtension(fileName: string): { stem: string; extension: string } {
  const lastDotIndex = fileName.lastIndexOf('.');
  const hasExtension = lastDotIndex > 0 && lastDotIndex < fileName.length - 1;
  if (!hasExtension) {
    return { stem: fileName, extension: '' };
  }
  return { stem: fileName.slice(0, lastDotIndex), extension: fileName.slice(lastDotIndex) };
}

/**
 * Guesses a file's MIME type from its extension.
 * @param fileName - The file name.
 * @returns The matching MIME type, or `application/octet-stream` when the extension is unknown.
 */
export function guessMimeTypeFromFileName(fileName: string): string {
  const { extension } = splitNameAndExtension(fileName);
  const lowercaseExtensionWithoutDot = extension.slice(1).toLowerCase();
  return mimeTypesByExtension[lowercaseExtensionWithoutDot] ?? unknownFileMimeType;
}
