import React, { useEffect, useRef } from 'react';

/** Native dialog provides focus containment, Escape dismissal and focus restoration. */
export function ScenePanel({ open, title, onClose, children, wide = false }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);
  return <dialog ref={ref} className={`scene-panel ${wide ? 'scene-panel-wide' : ''}`} aria-label={title}
    onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose}
    onClick={event => { if (event.target === ref.current) { const box = ref.current.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose(); } }}>
    <header className="panel-heading"><h2>{title}</h2><button type="button" onClick={onClose} aria-label={document.documentElement.lang === 'tr' ? 'Kapat' : 'Close'}>×</button></header>
    <div className="panel-body">{children}</div>
  </dialog>;
}
