export type DeepReadonly<T> = T extends (...args: never[]) => unknown ? T : T extends readonly (infer U)[] ? readonly DeepReadonly<U>[] : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export type SiteKind = 'landed' | 'planned-region' | 'candidate' | 'custom';
export interface Site { id: string; name: string; latDeg: number; lonDeg: number; surfaceElevationM: number | null; observerHeightM: number; kind: SiteKind; sourceIds: string[] }
export interface Scenario { id: string; site: Site; startUtc: string; endUtc: string; stepSeconds: number }
export interface ValidationError { field: string; code: string; message: string }
export type ValidationResult<T> = { ok: true; value: T; warnings: string[] } | { ok: false; errors: ValidationError[] };
export interface SourceRecord { id: string; url: string; productId: string; agency: string; accessedDate: string; coordinateFrame: string; usageTerms: string; evidence: string; coordinatePrecision: string; snapshotPath: string; [key: string]: unknown }
export interface DateCoverage { startUtc: string; endUtc: string }
export interface LocationCoverage { latMinDeg: number; latMaxDeg: number; lonMinDeg: number; lonMaxDeg: number }
export interface DataManifest { id: string; version: string; dataKind: 'real' | 'synthetic' | 'mixed'; sourceIds: string[]; dateCoverage: DateCoverage | null; locationCoverage: LocationCoverage }
export interface ScenarioOptions { manifest: DeepReadonly<DataManifest>; maxSamples?: number }
export declare const sites: DeepReadonly<Site[]>;
export declare const sources: DeepReadonly<SourceRecord[]>;
export declare const dataManifest: DeepReadonly<DataManifest>;
export declare function validateCatalog(siteRecords?: readonly DeepReadonly<Site>[], sourceRecords?: readonly DeepReadonly<SourceRecord>[]): ValidationResult<{ sites: readonly DeepReadonly<Site>[]; sources: readonly DeepReadonly<SourceRecord>[] }>;
export declare function normalizeLongitude(value: number | string): number;
export declare function validateSite(input: unknown): ValidationResult<Site>;
export declare function createCustomSite(input: unknown): ValidationResult<Site>;
export declare function validateScenario(input: unknown, options?: ScenarioOptions): ValidationResult<Scenario>;
export declare function getSiteById(id: string): Site | null;
export declare function getSourcesForSite(id: string): SourceRecord[];
