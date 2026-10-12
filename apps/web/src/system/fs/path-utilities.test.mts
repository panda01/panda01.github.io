import { describe, expect, it } from 'vitest';
import {
  getBaseName,
  getFolderDisplayName,
  getParentPath,
  isHiddenItemName,
  isPathInsideFolder,
  isValidItemName,
  joinPath,
  listPathAndAncestors,
  normalizePath,
  splitPathIntoNames,
} from './path-utilities.mts';

describe('splitPathIntoNames', () => {
  it('splits an absolute path and drops empty and "." segments', () => {
    expect(splitPathIntoNames('//Users/./guest/')).toEqual(['Users', 'guest']);
  });

  it('resolves ".." without climbing above the root', () => {
    expect(splitPathIntoNames('/Users/guest/../../..')).toEqual([]);
    expect(splitPathIntoNames('/Users/guest/Desktop/../Documents')).toEqual([
      'Users',
      'guest',
      'Documents',
    ]);
  });

  it('rejects relative paths', () => {
    expect(() => splitPathIntoNames('Users/guest')).toThrow('Expected an absolute path');
  });
});

describe('normalizePath / joinPath', () => {
  it('produces canonical paths', () => {
    expect(normalizePath('//Users/./guest/Desktop/../')).toBe('/Users/guest');
    expect(normalizePath('/')).toBe('/');
  });

  it('joins a folder and a child name', () => {
    expect(joinPath('/Users/guest', 'About Me.txt')).toBe('/Users/guest/About Me.txt');
    expect(joinPath('/', 'Users')).toBe('/Users');
  });
});

describe('getParentPath / getBaseName', () => {
  it('returns the containing folder and the last name', () => {
    expect(getParentPath('/Users/guest/Desktop')).toBe('/Users/guest');
    expect(getBaseName('/Users/guest/Desktop')).toBe('Desktop');
  });

  it('treats the root as its own parent with an empty name', () => {
    expect(getParentPath('/')).toBe('/');
    expect(getBaseName('/')).toBe('');
  });
});

describe('isPathInsideFolder', () => {
  it('accepts the folder itself and anything beneath it', () => {
    expect(isPathInsideFolder('/Users/guest', '/Users/guest')).toBe(true);
    expect(isPathInsideFolder('/Users/guest/Desktop/a', '/Users/guest')).toBe(true);
  });

  it('rejects siblings that only share a name prefix', () => {
    expect(isPathInsideFolder('/Users/guestbook', '/Users/guest')).toBe(false);
  });

  it('treats everything as inside the root', () => {
    expect(isPathInsideFolder('/anything/at/all', '/')).toBe(true);
  });
});

describe('isValidItemName', () => {
  it.each(['About Me.txt', 'untitled folder 2', '.Trash'])('accepts "%s"', (validName) => {
    expect(isValidItemName(validName)).toBe(true);
  });

  it.each(['', '   ', '.', '..', 'a/b'])('rejects "%s"', (invalidName) => {
    expect(isValidItemName(invalidName)).toBe(false);
  });
});

describe('isHiddenItemName', () => {
  it('hides dot-files like the Trash folder and shows everything else', () => {
    expect(isHiddenItemName('.Trash')).toBe(true);
    expect(isHiddenItemName('About Me.txt')).toBe(false);
  });
});

describe('getFolderDisplayName', () => {
  it('names the root, the Trash and ordinary folders the way Finder does', () => {
    expect(getFolderDisplayName('/')).toBe('Macintosh HD');
    expect(getFolderDisplayName('/Users/guest/.Trash/')).toBe('Trash');
    expect(getFolderDisplayName('/Users/guest/Projects')).toBe('Projects');
  });
});

describe('listPathAndAncestors', () => {
  it('lists the root, every folder in between, and the path itself', () => {
    expect(listPathAndAncestors('/Users/guest/Projects')).toEqual([
      '/',
      '/Users',
      '/Users/guest',
      '/Users/guest/Projects',
    ]);
    expect(listPathAndAncestors('/')).toEqual(['/']);
  });
});
