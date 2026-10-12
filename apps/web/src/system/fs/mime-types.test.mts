import { describe, expect, it } from 'vitest';
import { guessMimeTypeFromFileName, splitNameAndExtension } from './mime-types.mts';

describe('splitNameAndExtension', () => {
  it('splits at the last dot', () => {
    expect(splitNameAndExtension('About Me.txt')).toEqual({ stem: 'About Me', extension: '.txt' });
    expect(splitNameAndExtension('archive.tar.gz')).toEqual({
      stem: 'archive.tar',
      extension: '.gz',
    });
  });

  it('does not treat a leading dot, a trailing dot, or no dot as an extension', () => {
    expect(splitNameAndExtension('.Trash')).toEqual({ stem: '.Trash', extension: '' });
    expect(splitNameAndExtension('notes.')).toEqual({ stem: 'notes.', extension: '' });
    expect(splitNameAndExtension('Projects')).toEqual({ stem: 'Projects', extension: '' });
  });
});

describe('guessMimeTypeFromFileName', () => {
  it('maps known extensions case-insensitively', () => {
    expect(guessMimeTypeFromFileName('Resume.PDF')).toBe('application/pdf');
    expect(guessMimeTypeFromFileName('About Me.txt')).toBe('text/plain');
    expect(guessMimeTypeFromFileName('photo.jpeg')).toBe('image/jpeg');
  });

  it('falls back to a generic binary type', () => {
    expect(guessMimeTypeFromFileName('data.xyz')).toBe('application/octet-stream');
    expect(guessMimeTypeFromFileName('Makefile')).toBe('application/octet-stream');
  });
});
