export interface PortalInfo { name: string; state: 'accessed' | 'planned' | 'blocked' | 'integrated'; detail: string; url: string; }
export interface ScenarioInput { id: string; site: { id: string; name: string; latDeg: number; lonDeg: number; surfaceElevationM: number | null; observerHeightM: number; kind: string; sourceIds: string[] }; startUtc: string; endUtc: string; stepSeconds: number; horizonModel: 'flat'; }
export interface SiteRecord { id:string; name:string; latDeg:number; lonDeg:number; surfaceElevationM:number|null; observerHeightM:number; kind:'landed'|'planned-region'|'candidate'|'custom'; sourceIds:string[]; sources: {id:string;url:string;productId:string;agency:string}[]; }
export interface CatalogResponse { sites:SiteRecord[]; sources:{id:string;url:string;productId:string;agency:string}[]; }
export interface ResultEntry { scenario: ScenarioInput; sky: { timesUtc:string[]; sunAltDeg:number[]; sunAzDeg:number[]; earthAltDeg:number[]; earthAzDeg:number[]; quality:{model:string;frame:string;warnings:string[]} }; horizon:any; visibility:any; analysis:any; siteName:string; }
export interface AnalysisResponse { entries:ResultEntry[]; comparisons:{comparisons:any[]}; csv:string; }

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
}
export const getCatalog = () => request<CatalogResponse>('/api/catalog');
export const getPortals = () => request<PortalInfo[]>('/api/portals');
export async function analyzeScenarios(scenarios: ScenarioInput[]) {
  return request<{ entries: ResultEntry[]; comparisons: { comparisons: any[] }; csv: string }>('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenarios }) });
}
export const downloadCsvContent = (response:AnalysisResponse) => response.csv;
