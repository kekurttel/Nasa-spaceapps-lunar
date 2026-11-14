import { sites as catalogSites, sources as catalogSources } from './catalog.mjs';
export { normalizeLongitude, validateSite, createCustomSite, validateScenario } from './validation.mjs';
export { sites, sources, dataManifest, validateCatalog } from './catalog.mjs';

/** Return a defensive copy of a catalog site, or null when not found. */
export function getSiteById(id) {
  const site = catalogSites.find(item => item.id === id);
  return site ? clone(site) : null;
}

/** Return defensive copies of source records referenced by a site. */
export function getSourcesForSite(id) {
  const site = catalogSites.find(item => item.id === id);
  if (!site) return [];
  const byId = new Map(catalogSources.map(source => [source.id, source]));
  return site.sourceIds.map(sourceId => byId.get(sourceId)).filter(Boolean).map(clone);
}

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
  return value;
}
