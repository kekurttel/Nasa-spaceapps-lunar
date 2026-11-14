import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('saved date sweep remains explicitly same-model diagnostic with 14 days passing', () => {
  const report = JSON.parse(readFileSync(new URL('../fixtures/date-coverage-report.json', import.meta.url), 'utf8'));
  assert.equal(report.independentSourceClaim, false);
  assert.equal(report.dateCount, 14);
  assert.equal(report.dates.length, 14);
  assert.ok(report.dates.every((date: { acceptance: { passed: boolean } }) => date.acceptance.passed));
  assert.equal(report.method.sites.length, 4);
  assert.equal(report.method.comparisonTimesPerDate, 72);
});
