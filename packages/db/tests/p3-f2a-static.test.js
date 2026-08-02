/**
 * TG-02A — static validation for P3-F2a drafts (no database connection).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  P3_F2A_DRAFT_FILES,
  P3_F2A_FIRST_SLICE_TABLES,
  P3_F2A_SOFT_DELETE_TABLES,
  P3_F2A_FORBIDDEN_TABLE_SUBSTRINGS,
  P3_F2A_PROTECTED_SPINE_TABLES,
  P3_F2A_CLAIMS,
} from '../src/draft-catalog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRAFT_DIR = join(__dirname, '../migrations/drafts/p3-f2a');

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\n]*/g, '');
}

function readAllDrafts() {
  return P3_F2A_DRAFT_FILES.map((name) => {
    const path = join(DRAFT_DIR, name);
    const raw = readFileSync(path, 'utf8');
    return { name, path, raw, active: stripSqlComments(raw) };
  });
}

test('draft root exists and lists expected files only', () => {
  assert.equal(existsSync(DRAFT_DIR), true);
  const onDisk = readdirSync(DRAFT_DIR).filter((f) => f.endsWith('.sql')).sort();
  assert.deepEqual(onDisk, [...P3_F2A_DRAFT_FILES].sort());
});

test('every draft marked DRAFT_ONLY / DO_NOT_APPLY / F2b auth required', () => {
  for (const draft of readAllDrafts()) {
    assert.match(draft.raw, /DRAFT_ONLY/);
    assert.match(draft.raw, /DO_NOT_APPLY/);
    assert.match(draft.raw, /P3_F2B_OWNER_AUTHORIZATION_REQUIRED/);
  }
});

test('no active DROP / RENAME / ALTER on protected spine tables', () => {
  for (const draft of readAllDrafts()) {
    const active = draft.active;
    assert.equal(/\bDROP\s+TABLE\b/i.test(active), false, draft.name);
    assert.equal(/\bDROP\s+COLUMN\b/i.test(active), false, draft.name);
    assert.equal(/\bRENAME\b/i.test(active), false, draft.name);
    for (const table of P3_F2A_PROTECTED_SPINE_TABLES) {
      const alterRe = new RegExp(`\\bALTER\\s+TABLE\\s+(public\\.)?${table}\\b`, 'i');
      assert.equal(alterRe.test(active), false, `${draft.name} alters ${table}`);
      const dropRe = new RegExp(`\\bDROP\\s+TABLE\\s+(IF\\s+EXISTS\\s+)?(public\\.)?${table}\\b`, 'i');
      assert.equal(dropRe.test(active), false, `${draft.name} drops ${table}`);
    }
  }
});

test('first-slice tables drafted; soft-delete fields present where required', () => {
  const combined = readAllDrafts().map((d) => d.active).join('\n');
  for (const table of P3_F2A_FIRST_SLICE_TABLES) {
    const re = new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+public\\.${table}\\b`, 'i');
    assert.equal(re.test(combined), true, `missing table ${table}`);
  }
  for (const table of P3_F2A_SOFT_DELETE_TABLES) {
    // soft-delete columns appear in the CREATE for that table block — search file containing table
    const file = readAllDrafts().find((d) => d.active.includes(`public.${table}`));
    assert.ok(file, table);
    assert.match(file.active, /deleted_at/);
    assert.match(file.active, /deleted_by_actor_type/);
    assert.match(file.active, /deleted_by_actor_id/);
    assert.match(file.active, /deletion_reason/);
  }
});

test('ops audit actor fields compatible with P3-F1 principals', () => {
  const audit = readAllDrafts().find((d) => d.name === '080_ops_audit_events.sql');
  assert.ok(audit);
  assert.match(audit.active, /actor_type/);
  assert.match(audit.active, /actor_id/);
  assert.match(audit.active, /correlation_id/);
  assert.match(audit.active, /PERSON_PRINCIPAL/);
  assert.match(audit.active, /SERVICE_PRINCIPAL/);
  assert.match(audit.active, /BREAK_GLASS_PRINCIPAL/);
  assert.match(audit.active, /metadata_redacted/);
});

test('outbox has idempotency key and no worker activation', () => {
  const outbox = readAllDrafts().find((d) => d.name === '100_transactional_outbox.sql');
  assert.ok(outbox);
  assert.match(outbox.active, /idempotency_key/);
  assert.match(outbox.raw, /AUTOMATION_ACTIVATION=NO/);
  assert.match(outbox.raw, /no worker/i);
});

test('no forbidden domain tables / Averion / secrets / permissive RLS', () => {
  const combinedRaw = readAllDrafts().map((d) => d.raw.toLowerCase()).join('\n');
  const combinedActive = readAllDrafts().map((d) => d.active.toLowerCase()).join('\n');
  for (const bad of P3_F2A_FORBIDDEN_TABLE_SUBSTRINGS) {
    assert.equal(combinedRaw.includes(bad), false, `forbidden term: ${bad}`);
  }
  assert.equal(/using\s*\(\s*true\s*\)/.test(combinedActive), false);
  assert.equal(/create\s+policy/.test(combinedActive), false);
  assert.equal(/grant\s+.*(anon|authenticated|public)\b/.test(combinedActive), false);
  assert.equal(/password\s*=|api[_-]?key\s*=|secret\s*=/.test(combinedRaw), false);
});

test('claims remain non-production', () => {
  assert.equal(P3_F2A_CLAIMS.STRONG_AUTHZ_COMPLETE, false);
  assert.equal(P3_F2A_CLAIMS.PRODUCTION_RLS_READY, false);
  assert.equal(P3_F2A_CLAIMS.MIGRATION_APPLICATION_AUTHORIZED, false);
  assert.equal(P3_F2A_CLAIMS.DRAFT_ONLY, true);
});

test('draft root is not under supabase/migrations', () => {
  assert.equal(DRAFT_DIR.includes(`${join('supabase', 'migrations')}`), false);
  assert.equal(existsSync(join(__dirname, '../../../supabase/migrations/001_leads_phase_a.sql')), true);
});
