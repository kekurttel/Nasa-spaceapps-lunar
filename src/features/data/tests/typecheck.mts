import { sites, sources, dataManifest, validateCatalog, validateScenario, getSiteById, normalizeLongitude } from '../index.mjs';
import type { Site, Scenario, ScenarioOptions, SourceRecord } from '../index.mjs';

const site: Site | null = getSiteById('apollo-11');
if (site) {
  const scenario: Scenario = { id: 'typed', site, startUtc: '2026-01-01T00:00:00Z', endUtc: '2026-01-02T00:00:00Z', stepSeconds: 3600 };
  const options: ScenarioOptions = { manifest: dataManifest, maxSamples: 1000 };
  const result = validateScenario(scenario, options);
  if (result.ok) {
    const output: Site = result.value.site;
    output.sourceIds.push('mutable-copy');
  }
  // @ts-expect-error Scenario embeds Site, never a site id.
  const invalid: Scenario = { ...scenario, site: site.id };
  void invalid;
}
const result = validateCatalog(sites, sources);
if (result.ok) {
  const source: Readonly<SourceRecord> | undefined = result.value.sources[0];
  void source;
}
normalizeLongitude('270');
// @ts-expect-error Immutable shared catalogue cannot be appended to.
sites.push({});
// @ts-expect-error Nested catalogue source references are immutable.
sites[0].sourceIds.push('changed');
// @ts-expect-error Manifest coverage is deeply immutable.
dataManifest.locationCoverage.latMinDeg = 0;
