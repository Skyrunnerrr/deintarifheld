import test from 'node:test';
import assert from 'node:assert/strict';
import { KillDomain, KillState } from '@deintarifheld/shared';
import { CcKillStatusContract, createKillStatusAdapter } from './contracts.js';

test('CC kill contract forbids UI and strong authz', () => {
  assert.equal(CcKillStatusContract.uiImplemented, false);
  assert.equal(CcKillStatusContract.writeActionsViaUi, false);
  assert.equal(CcKillStatusContract.strongAuthzComplete, false);
  assert.equal(CcKillStatusContract.domainCount, 8);
});

test('kill status adapter is read-only bridge', async () => {
  const adapter = createKillStatusAdapter({
    readAll: () => ({ ok: true, domains: [{ domain: KillDomain.PUBLIC_INTAKE, state: KillState.INACTIVE }], count: 1 }),
    readOne: (domain) => ({ ok: true, domain, state: KillState.INACTIVE }),
  });
  assert.equal(adapter.uiImplemented, false);
  const all = await adapter.listStatuses();
  assert.equal(all.ok, true);
  const one = await adapter.getStatus(KillDomain.PUBLIC_INTAKE);
  assert.equal(one.state, KillState.INACTIVE);
});
