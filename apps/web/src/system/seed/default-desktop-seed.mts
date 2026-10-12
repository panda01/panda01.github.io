import type { LinkTarget } from '../fs/file-system.types.mts';
import { desktopFolderPath, homeFolderPath, trashFolderPath } from '../fs/path-utilities.mts';

/**
 * Version of the default desktop below. Increase it whenever the seed changes; returning visitors
 * then receive new and updated seed items without losing anything they changed themselves.
 */
export const currentSeedVersion = 2;

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

const projectsFolderPath = `${homeFolderPath}/Projects`;

/**
 * The default desktop. File contents live in the repository's `content/` folder: Resume.pdf is the
 * owner's real resume, while About Me, the project READMEs and the Email address are still
 * placeholders to be replaced with the owner's real content.
 */
export const defaultDesktopSeedEntries: readonly SeedEntry[] = [
  { kind: 'folder', path: homeFolderPath },
  { kind: 'folder', path: desktopFolderPath },
  { kind: 'folder', path: `${homeFolderPath}/Documents` },
  { kind: 'folder', path: `${homeFolderPath}/Downloads` },
  { kind: 'folder', path: projectsFolderPath },
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
    kind: 'link',
    path: `${desktopFolderPath}/Projects`,
    linkTarget: { kind: 'path', path: projectsFolderPath },
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
    path: `${desktopFolderPath}/Email`,
    linkTarget: { kind: 'url', url: 'mailto:hello@example.com' },
  },
  { kind: 'folder', path: `${projectsFolderPath}/Example Project One` },
  {
    kind: 'file',
    path: `${projectsFolderPath}/Example Project One/README.txt`,
    contentSourcePath: 'Projects/Example Project One/README.txt',
    mimeType: 'text/plain',
  },
  { kind: 'folder', path: `${projectsFolderPath}/Example Project Two` },
  {
    kind: 'file',
    path: `${projectsFolderPath}/Example Project Two/README.txt`,
    contentSourcePath: 'Projects/Example Project Two/README.txt',
    mimeType: 'text/plain',
  },
];
