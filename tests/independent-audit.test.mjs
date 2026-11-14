import test from 'node:test';
import assert from 'node:assert/strict';
import { solarVisibleFraction } from '../src/features/visibility/visibility.mjs';
import { interpolateHorizon } from '../src/features/visibility/horizon.mjs';

// Coordinator-owned independent checks: expected values are not obtained from the implementation.
test('solar area agrees with Cartesian lattice integration at multiple offsets', () => {
  const n = 700;
  for (const center of [-0.85, -0.4, 0, 0.23, 0.7]) {
    let inside = 0, visible = 0;
    for (let i = 0; i < n; i++) {
      const x = -1 + (i + 0.5) * 2 / n;
      for (let j = 0; j < n; j++) {
        const y = -1 + (j + 0.5) * 2 / n;
        if (x * x + y * y <= 1) {
          inside++;
          if (y + center > 0) visible++;
        }
      }
    }
    assert.ok(Math.abs(solarVisibleFraction(center, 0, 1) - visible / inside) < 0.002,
      `center=${center}; numerical=${visible / inside}`);
    assert.ok(Math.abs(solarVisibleFraction(center, 0, 1) + solarVisibleFraction(-center, 0, 1) - 1) < 1e-12);
  }
});

test('nonuniform horizon agrees with independently unwrapped seam arithmetic', () => {
  const p = {siteId:'audit', azimuthDeg:[30,120,250], elevationDeg:[10,40,-20], model:'terrain', dataKind:'synthetic',sourceIds:['audit-only'],observerHeightM:0,warnings:[]};
  for (const [angle,expected] of [[15,95/14],[25,125/14],[350,10/7],[-10,10/7],[375,95/14]]) {
    assert.ok(Math.abs(interpolateHorizon(p, angle) - expected) < 1e-12);
  }
});
