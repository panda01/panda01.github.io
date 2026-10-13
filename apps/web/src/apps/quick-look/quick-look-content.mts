import type { FileSystemItem } from '../../system/fs/file-system.types.mts';

/** Bytes converted per step when building a data URL (keeps each conversion call small). */
const dataUrlChunkSize = 0x8000;

/**
 * Turns a text file's bytes into text (UTF-8; invalid bytes become the replacement character).
 * @param fileContent - The file's bytes.
 * @returns The text.
 */
export function decodeTextContent(fileContent: Uint8Array): string {
  return new TextDecoder().decode(fileContent);
}

/**
 * Turns an image file's bytes into a `data:` URL an `<img>` can show. Images inside `<img>` never
 * run scripts, so this is safe even for SVG files.
 * @param fileContent - The image's bytes.
 * @param mimeType - The image's type, for example "image/png".
 * @returns The data URL.
 */
export function createDataUrl(fileContent: Uint8Array, mimeType: string): string {
  let binaryText = '';
  for (let chunkStart = 0; chunkStart < fileContent.length; chunkStart += dataUrlChunkSize) {
    binaryText += String.fromCharCode(
      ...fileContent.subarray(chunkStart, chunkStart + dataUrlChunkSize),
    );
  }
  return `data:${mimeType};base64,${btoa(binaryText)}`;
}

/**
 * Builds a key that changes exactly when a file's content can have changed.
 * @param item - The file.
 * @returns Its id, modification time and size, joined.
 */
export function buildContentVersionKey(item: FileSystemItem): string {
  return `${item.id}:${String(item.modifiedAt)}:${String(item.sizeInBytes)}`;
}
