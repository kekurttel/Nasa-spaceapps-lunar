import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'lunarsight-palette';
type Palette = 'a' | 'b' | 'c';

function initialPalette(): Palette {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'b' || stored === 'c' ? stored : 'a';
  } catch {
    return 'a';
  }
}

export function AppearanceSettings({ language }: { language: 'en' | 'tr' }) {
  const [palette, setPalette] = useState<Palette>(initialPalette);
  useEffect(() => {
    document.documentElement.dataset.palette = palette;
    try { localStorage.setItem(STORAGE_KEY, palette); } catch { /* Storage may be unavailable. */ }
  }, [palette]);

  return (
    <label className="appearance-picker">
      {language === 'tr' ? 'Görünüm' : 'Appearance'}
      <select value={palette} onChange={event => setPalette(event.target.value as Palette)}>
        <option value="a">{language === 'tr' ? 'Palet A (varsayılan)' : 'Palette A (default)'}</option>
        <option value="b">{language === 'tr' ? 'Palet B' : 'Palette B'}</option>
        <option value="c">{language === 'tr' ? 'Palet C' : 'Palette C'}</option>
      </select>
    </label>
  );
}
