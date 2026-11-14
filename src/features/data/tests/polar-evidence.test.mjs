import test from 'node:test';
import assert from 'node:assert/strict';
import { polarEvidenceSources, psrValidationOptions, validatePolarEvidence } from '../polar/evidence.mjs';

test('verified metadata manifest passes and exports are deeply frozen', () => {
  assert.deepEqual(validatePolarEvidence(), { ok: true });
  assert.ok(Object.isFrozen(polarEvidenceSources));
  assert.ok(Object.isFrozen(polarEvidenceSources[0]));
  assert.ok(Object.isFrozen(psrValidationOptions.requiredFamilies));
});

test('malformed validator options return validation errors without throwing', () => {
  assert.doesNotThrow(() => {
    const result = validatePolarEvidence(polarEvidenceSources, { acceptedEvidenceTypes: {}, requiredFamilies: 1 });
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map(({ field }) => field), ['options.acceptedEvidenceTypes', 'options.requiredFamilies', 'options.requireProductIdOrNull', 'options.requireExplicitCoordinateFrame']);
  });
});

test('rejects duplicate source IDs and missing evidence families', () => {
  const source = polarEvidenceSources[0];
  const result = validatePolarEvidence([source, { ...source }]);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === 'duplicate'));
  assert.ok(result.errors.some(error => error.code === 'missing_family'));
});

test('requires explicit coverage, terms and metadata-only local state', () => {
  const source = { ...polarEvidenceSources[0], temporalCoverage: '', spatialCoverage: '', usageTerms: {}, localDataAvailable: true };
  const result = validatePolarEvidence([source], { ...psrValidationOptions, requiredFamilies: [] });
  assert.equal(result.ok, false);
  for (const code of ['required', 'invalid_terms', 'local_data_state']) assert.ok(result.errors.some(error => error.code === code));
});

test('does not mutate caller-provided inputs', () => {
  const supplied = polarEvidenceSources.map(source => ({ ...source, usageTerms: { ...source.usageTerms } }));
  const before = structuredClone(supplied);
  validatePolarEvidence(supplied);
  assert.deepEqual(supplied, before);
});
