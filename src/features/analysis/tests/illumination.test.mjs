import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIllumination, planHierarchicalIllumination } from '../illumination.mjs';
const t = s => new Date(Date.UTC(2026, 0, 1) + s * 1000).toISOString();
const grid = { width: 1, height: 1, crs: 'LOCAL_POLAR_TEST', units: 'm', originXM: 0, originYM: 0, pixelSizeXM: 80, pixelSizeYM: 80 };
const input = (frames, end = 10) => ({ schemaVersion: 'temporal-illumination/v1', grid, startUtc: t(0), endUtc: t(end), frames: frames.map(([a,b,v]) => ({startUtc:t(a),endUtc:t(b),fractions:[v]})), quality: {dataKind:'synthetic'} });
const cell = (frames, end=10, options) => analyzeIllumination(input(frames,end),options).cells[0];
test('unequal explicit intervals, exact boundaries, penumbra and transitions',()=>{
 const c=cell([[0,2,0],[2,7,0.5],[7,10,1]]);
 assert.equal(c.metrics.totalIlluminatedSeconds,8);assert.equal(c.metrics.totalPenumbralSeconds,5);
 assert.equal(c.metrics.equivalentFullSunSeconds,5.5);assert.equal(c.metrics.shadowTransitionCount,2);
 assert.equal(c.metrics.illuminationTransitionCount,1);assert.equal(c.metrics.timeToNextSunlightSeconds,2);
 assert.equal(c.metrics.firstIlluminationUtc,t(2));assert.equal(c.metrics.lastIlluminationEndExclusiveUtc,t(10));
 assert.equal(c.metrics.maxContinuousSunlitSeconds,8);
});
test('missing intervals and NoData never darkness, bridge runs or count transitions',()=>{
 const c=cell([[0,2,0],[4,6,0],[6,8,null],[8,10,1]]);
 assert.equal(c.metrics.totalUmbralSeconds,4);assert.equal(c.metrics.maxContinuousDarkSeconds,2);
 assert.equal(c.metrics.missingSeconds,4);assert.equal(c.metrics.shadowTransitionCount,0);
 assert.equal(c.metrics.timeToNextSunlightSeconds,null);assert.equal(c.classification,'UNKNOWN_OR_INSUFFICIENT_COVERAGE');
});
test('no final-sample extrapolation; no frames and NoData unknown',()=>{
 assert.equal(cell([[0,2,1]]).metrics.illuminationCoverageFraction,0.2);
 assert.equal(cell([]).sdf.illuminationDutyCycle,null);
 assert.equal(cell([[0,10,null]]).metrics.maxContinuousDarkSeconds,null);
 assert.throws(()=>analyzeIllumination({...input([]),frames:[{startUtc:t(0),fractions:[1]}]}),/UTC/);
});
test('conservative interval classifications, no permanent claim including incomplete nodal cycle',()=>{
 assert.equal(cell([[0,10,1]]).classification,'ALWAYS_ILLUMINATED_IN_INTERVAL');
 assert.equal(cell([[0,10,0.5]]).classification,'PARTIAL_ILLUMINATION_REGIME');
 const dark=cell([[0,10,0]]);assert.equal(dark.classification,'PERSISTENT_SHADOW_IN_INTERVAL');
 assert.equal(dark.longTermAssessment.permanentShadowClaim,false);assert.equal(dark.longTermAssessment.nodalCycleDurationSatisfied,false);
 assert.equal(cell([[0,5,0],[5,10,1]]).classification,'INTERMITTENTLY_ILLUMINATED');
});
test('weighted seasonal variance and reproducible raw SDF',()=>{
 const x=input([[0,2,0],[2,10,1]]);
 const options={seasons:[{id:'a',startUtc:t(0),endUtc:t(2)},{id:'b',startUtc:t(2),endUtc:t(10)}]};
 const a=analyzeIllumination(x,options);assert.ok(Math.abs(a.cells[0].sdf.seasonalIlluminationVariance-0.16)<1e-12);
 assert.deepEqual(a,analyzeIllumination(x,options));
 assert.equal(cell([[0,10,1]]).sdf.seasonalIlluminationVariance,null);
});
test('reject overlapping times, invalid calendar, sparse cells and changed resolution',()=>{
 assert.throws(()=>analyzeIllumination(input([[0,6,0],[5,10,1]])),/ordered/);
 const x=input([[0,10,1]]);x.frames[0].grid={...grid,pixelSizeXM:160};assert.throws(()=>analyzeIllumination(x),/Resolution/);
 const y=input([[0,10,1]]);y.frames[0].fractions=Array(1);assert.throws(()=>analyzeIllumination(y),/dense/);
 assert.throws(()=>analyzeIllumination({...input([]),startUtc:'2026-02-30T00:00:00Z'}),/calendar/);
});
test('long uninterrupted dark support and explicit hierarchy planning',()=>{
 const c=cell([[0,100000,0]],100000);assert.equal(c.metrics.maxContinuousDarkSeconds,100000);
 const p=planHierarchicalIllumination();assert.equal(p.status,'PLAN_ONLY_NOT_EXECUTED');assert.equal(p.stages[2].resolutionM,80);
 assert.throws(()=>planHierarchicalIllumination({screeningResolutionM:40}),/hierarchy/);
});
