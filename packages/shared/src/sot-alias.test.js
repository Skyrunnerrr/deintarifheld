import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSotAlias, SotResourceType, SOT_ALIAS_MAP } from './sot-alias.js';

test('alias map has exactly INTERNAL_NOTE and CONTACT_ATTEMPT', () => {
  assert.deepEqual(Object.keys(SOT_ALIAS_MAP).sort(), ['CONTACT_ATTEMPT', 'INTERNAL_NOTE']);
});

test('canonical direct CASE_NOTE allowed', () => {
  const r = resolveSotAlias({ canonicalResourceType: SotResourceType.CASE_NOTE });
  assert.equal(r.ok, true);
  assert.equal(r.aliasResolution, 'CANONICAL_DIRECT');
});
