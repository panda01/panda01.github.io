import { fireEvent, render, screen } from '@testing-library/react';
import { ButtonBase } from '@mui/material';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InlineRenameField } from './InlineRenameField.tsx';
import {
  findNeighborItemElement,
  findSelectionMoveDirection,
  itemPathAttributeName,
} from './item-view-navigation.mts';

describe('InlineRenameField', () => {
  it('keeps the typed name when focus leaves, reporting it only once', async () => {
    const onFinish = vi.fn();
    render(
      <InlineRenameField initialName="Notes" selectedCharacterCount={5} onFinish={onFinish} />,
    );
    const nameField = screen.getByRole('textbox', { name: 'Name' });

    await userEvent.type(nameField, ' 2');
    await userEvent.keyboard('{Enter}');
    fireEvent.blur(nameField);

    expect(onFinish).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledWith('Notes 2');
  });

  it('keeps clicks inside the field from reaching the item underneath', () => {
    const onItemClick = vi.fn();
    render(
      <ButtonBase component="div" onClick={onItemClick} onDoubleClick={onItemClick}>
        <InlineRenameField initialName="Notes" selectedCharacterCount={5} onFinish={vi.fn()} />
      </ButtonBase>,
    );
    const nameField = screen.getByRole('textbox', { name: 'Name' });

    fireEvent.click(nameField);
    fireEvent.doubleClick(nameField);
    fireEvent.blur(nameField);

    expect(onItemClick).not.toHaveBeenCalled();
  });
});

describe('item view navigation', () => {
  it('maps arrow keys to selection moves', () => {
    expect(findSelectionMoveDirection('ArrowDown')).toBe('next');
    expect(findSelectionMoveDirection('ArrowUp')).toBe('previous');
    expect(findSelectionMoveDirection('a')).toBeUndefined();
  });

  it('finds no neighbour for an item outside any item view', () => {
    const looseItem = document.createElement('button');
    looseItem.setAttribute(itemPathAttributeName, '/a');

    expect(findNeighborItemElement(looseItem, 'next')).toBeUndefined();
  });
});
