// CRA embeds REACT_APP_* at build time. Include /api in explicit overrides.
const configuredBase = process.env.REACT_APP_API_URL?.trim();

export const API_BASE = (
  configuredBase || (process.env.NODE_ENV === 'development' ? 'http://localhost:8000/api' : '/api')
).replace(/\/+$/, '');
