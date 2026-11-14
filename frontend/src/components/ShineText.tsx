import React from 'react';

/** Readable base plus a decorative, left-to-right masked duplicate. */
export function ShineText({ children, entrance = false }: { children: string; entrance?: boolean }) {
  return <span className={`shine-text${entrance ? ' shine-entrance' : ''}`}><span>{children}</span><span aria-hidden="true" className="shine-band">{children}</span></span>;
}
