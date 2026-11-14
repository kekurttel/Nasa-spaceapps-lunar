import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppearanceSettings } from './AppearanceSettings';

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.palette;
});

test('defaults to palette A and falls back for invalid stored values', () => {
  localStorage.setItem('lunarsight-palette', 'invalid');
  render(<AppearanceSettings language="en" />);
  expect(screen.getByLabelText('Appearance')).toHaveValue('a');
  expect(document.documentElement.dataset.palette).toBe('a');
});

test('persists selection and restores it on remount', () => {
  const { unmount } = render(<AppearanceSettings language="tr" />);
  fireEvent.change(screen.getByLabelText('Görünüm'), { target: { value: 'c' } });
  expect(localStorage.getItem('lunarsight-palette')).toBe('c');
  expect(document.documentElement.dataset.palette).toBe('c');
  unmount();
  render(<AppearanceSettings language="en" />);
  expect(screen.getByLabelText('Appearance')).toHaveValue('c');
});
