import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ItemIconKind } from '../../system/fs/item-presentation.mts';
import { ItemIcon } from './item-icons.tsx';
import {
  AboutThisMacAppIcon,
  FinderAppIcon,
  QuickLookAppIcon,
  SystemLogoIcon,
  TrashCanIcon,
} from './system-icons.tsx';

const everyItemIconKind: ItemIconKind[] = [
  'folder',
  'folder-alias',
  'text-document',
  'pdf-document',
  'image-document',
  'generic-document',
  'web-link',
  'email-link',
];

describe('item icons', () => {
  it.each(everyItemIconKind)('draws a decorative %s icon at the requested size', (iconKind) => {
    const { container } = render(<ItemIcon iconKind={iconKind} size={48} />);
    const svgElement = container.querySelector('svg');

    expect(svgElement).toHaveAttribute('width', '48');
    expect(svgElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('labels PDF documents', () => {
    const { container } = render(<ItemIcon iconKind="pdf-document" size={48} />);
    expect(container.textContent).toBe('PDF');
  });
});

describe('system icons', () => {
  it('draw the logo, the app tiles, and the Trash', () => {
    const { container } = render(
      <>
        <SystemLogoIcon size={16} />
        <AboutThisMacAppIcon size={48} />
        <FinderAppIcon size={48} />
        <QuickLookAppIcon size={48} />
        <TrashCanIcon size={48} isFull={false} />
      </>,
    );
    expect(container.querySelectorAll('svg')).toHaveLength(5);
  });

  it('gives each Finder icon its own gradient id', () => {
    const { container } = render(
      <>
        <FinderAppIcon size={48} />
        <FinderAppIcon size={48} />
      </>,
    );
    const gradientIds = Array.from(container.querySelectorAll('linearGradient'), (gradient) =>
      gradient.getAttribute('id'),
    );
    expect(new Set(gradientIds).size).toBe(2);
  });

  it('draws papers only in a full Trash', () => {
    const { container: emptyTrash } = render(<TrashCanIcon size={48} isFull={false} />);
    const { container: fullTrash } = render(<TrashCanIcon size={48} isFull />);
    expect(fullTrash.querySelectorAll('circle').length).toBeGreaterThan(
      emptyTrash.querySelectorAll('circle').length,
    );
  });
});
