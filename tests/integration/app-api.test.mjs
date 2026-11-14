import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigatorServer } from '../../server/app.mjs';

const good = (id, siteId, start='2026-01-01T00:00:00Z', end='2026-01-01T03:00:00Z') => ({
 id, horizonModel:'flat', startUtc:start, endUtc:end, stepSeconds:3600,
 site:{id:siteId,name:siteId,latDeg:0,lonDeg:0,surfaceElevationM:0,observerHeightM:1.6,kind:'custom',sourceIds:[]}
});
let server, origin;
test('API serves real pipeline results, metadata CSV and strict input errors', async t => {
 server=createNavigatorServer(); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); origin=`http://127.0.0.1:${server.address().port}`;
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const catalog=await fetch(`${origin}/api/catalog`).then(r=>r.json()); assert.equal(catalog.sites.length,9);
 const portals=await fetch(`${origin}/api/portals`).then(r=>r.json()); assert.deepEqual(portals.map(p=>p.state),['planned','accessed','accessed','accessed']);
 const response=await fetch(`${origin}/api/analyze`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scenarios:[good('one','custom-one'),good('two','custom-two','2026-01-01T06:00:00Z','2026-01-01T09:00:00Z')]})});
 assert.equal(response.status,200); const result=await response.json(); assert.equal(result.entries.length,2); assert.equal(result.entries[0].sky.quality.frame,'IAU_MOON'); assert.equal(result.entries[0].visibility.quality.horizonModel,'flat'); assert.equal(result.entries[0].analysis.quality.sourceIds[0],'naif-de440s-moon-fixed-2026-01'); assert.match(result.csv,/sourceIds/); assert.match(result.csv,/model=|NASA\/JPL NAIF/);
 const request=async scenarios=>fetch(`${origin}/api/analyze`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scenarios})});
 for (const bad of [ {...good('bad','id'),'startUtc':'2026-01-01T00:00:00+00:00'}, {...good('bad','id'),'startUtc':'2026-02-30T00:00:00Z'}, {...good('bad','id'),horizonModel:undefined}, {...good('bad','id'),terrainDocument:{profile:{model:'terrain'}}}, {...good('bad','id'),site:undefined}, {...good('bad','id'),stepSeconds:0}, good('bad','id','2026-01-03T00:00:00Z','2026-01-03T01:00:00Z') ]) { const r=await request([bad]); assert.ok(r.status>=400); }
 assert.equal((await request([])).status,400); assert.equal((await request([good('1','a'),good('2','b'),good('3','c'),good('4','d'),good('5','e')])).status,400);
 const preflight=await fetch(`${origin}/api/analyze`,{method:'OPTIONS'}); assert.equal(preflight.status,204);
 const oversized=await fetch(`${origin}/api/analyze`,{method:'POST',headers:{'content-type':'application/json'},body:' '.repeat(1_000_001)}); assert.equal(oversized.status,413);
});
