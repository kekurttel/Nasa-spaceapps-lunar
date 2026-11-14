import { performance } from 'node:perf_hooks';
import { analyzeIllumination } from '../src/features/analysis/illumination.mjs';
const start=Date.UTC(2026,0,1), iso=t=>new Date(t).toISOString();
const frames=Array.from({length:96},(_,i)=>({startUtc:iso(start+i*3600000),endUtc:iso(start+(i+1)*3600000),fractions:Array.from({length:4096},(_,c)=>(c+i)%3/2)}));
const input={schemaVersion:'temporal-illumination/v1',grid:{width:64,height:64,crs:'SYNTHETIC_LOCAL_METRIC',units:'m',originXM:0,originYM:0,pixelSizeXM:80,pixelSizeYM:80},startUtc:iso(start),endUtc:iso(start+96*3600000),frames,quality:{dataKind:'synthetic'}};
const before=performance.now();const result=analyzeIllumination(input);
console.log(JSON.stringify({kind:'synthetic-only-not-DEM-or-long-term-convergence',cells:result.cells.length,frames:frames.length,cellIntervals:4096*96,elapsedMs:performance.now()-before,rssBytes:process.memoryUsage().rss,node:process.version}));
