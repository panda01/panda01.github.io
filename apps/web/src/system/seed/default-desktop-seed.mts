import type { LinkTarget } from '../fs/file-system.types.mts';
import { desktopFolderPath, homeFolderPath, trashFolderPath } from '../fs/path-utilities.mts';

/**
 * Version of the default desktop below. Increase it whenever the seed changes; returning visitors
 * then receive new and updated seed items without losing anything they changed themselves.
 * Seeding never deletes, so items dropped from the seed (such as the old Projects folder) stay
 * with visitors who already have them.
 */
export const currentSeedVersion = 3;

/** One item of the default desktop that every visitor starts with. */
export type SeedEntry =
  | { kind: 'folder'; path: string }
  | {
      kind: 'file';
      path: string;
      /** Path of the source file inside the repository's `content/` folder. */
      contentSourcePath: string;
      mimeType: string;
    }
  | { kind: 'link'; path: string; linkTarget: LinkTarget };

/**
 * The default desktop. File contents live in the repository's `content/` folder: Resume.pdf and
 * the cover letter are the owner's real documents, while About Me and the Email address are still
 * placeholders to be replaced with the owner's real content.
 */
export const defaultDesktopSeedEntries: readonly SeedEntry[] = [
  { kind: 'folder', path: homeFolderPath },
  { kind: 'folder', path: desktopFolderPath },
  { kind: 'folder', path: `${homeFolderPath}/Documents` },
  { kind: 'folder', path: `${homeFolderPath}/Downloads` },
  { kind: 'folder', path: trashFolderPath },
  {
    kind: 'file',
    path: `${desktopFolderPath}/About Me.txt`,
    contentSourcePath: 'Desktop/About Me.txt',
    mimeType: 'text/plain',
  },
  {
    kind: 'file',
    path: `${desktopFolderPath}/Resume.pdf`,
    contentSourcePath: 'Desktop/Resume.pdf',
    mimeType: 'application/pdf',
  },
  {
    kind: 'file',
    path: `${desktopFolderPath}/Cover Letter.pdf`,
    contentSourcePath: 'Desktop/Cover Letter.pdf',
    mimeType: 'application/pdf',
  },
  {
    kind: 'link',
    path: `${desktopFolderPath}/GitHub`,
    linkTarget: { kind: 'url', url: 'https://github.com/panda01' },
  },
  {
    kind: 'link',
    path: `${desktopFolderPath}/LinkedIn`,
    linkTarget: { kind: 'url', url: 'https://www.linkedin.com/in/khalahjonesgolden/' },
  },
  {
    kind: 'link',
    path: `${desktopFolderPath}/Musings`,
    linkTarget: { kind: 'url', url: 'https://khalah.medium.com/' },
  },
  {
    kind: 'link',
    path: `${desktopFolderPath}/Email`,
    linkTarget: { kind: 'url', url: 'mailto:hello@example.com' },
  },
];
