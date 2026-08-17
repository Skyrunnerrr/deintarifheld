/**
 * Local test document storage. No live provider.
 * LIVE_DOCUMENT_STORAGE_PROVIDER_CALLS must remain 0.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

const memory = new Map(); // storageKey -> Buffer
let liveCallCount = 0;
let diskRoot = null;

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export function resetLocalTestDocumentStorage() {
  memory.clear();
  liveCallCount = 0;
  diskRoot = null;
}

export function getDocumentStorageLiveCallCount() {
  return liveCallCount;
}

function assertLocalOnly(dbUrl) {
  if (!dbUrl) return;
  try {
    const u = new URL(dbUrl);
    if (!LOCAL_HOSTS.has(u.hostname)) {
      throw new Error('NON_LOCAL_DOCUMENT_STORAGE_FORBIDDEN');
    }
  } catch (err) {
    if (err.message === 'NON_LOCAL_DOCUMENT_STORAGE_FORBIDDEN') throw err;
    if (!/127\.0\.0\.1|localhost/.test(String(dbUrl))) {
      throw new Error('NON_LOCAL_DOCUMENT_STORAGE_FORBIDDEN');
    }
  }
}

function safeJoinUnderRoot(root, key) {
  if (!key || typeof key !== 'string') throw new Error('STORAGE_KEY_INVALID');
  if (key.includes('\0') || key.includes('..') || key.startsWith('/') || key.includes('\\')) {
    throw new Error('PATH_TRAVERSAL_REJECTED');
  }
  const full = resolve(root, key);
  const rootResolved = resolve(root) + sep;
  if (!full.startsWith(rootResolved) && full !== resolve(root)) {
    throw new Error('PATH_TRAVERSAL_REJECTED');
  }
  return full;
}

/**
 * @param {{ dbUrl?: string, enableDisk?: boolean }} [opts]
 */
export function createLocalTestDocumentStorage(opts = {}) {
  const dbUrl = opts.dbUrl || process.env.DTH_A1_DATABASE_URL || '';
  assertLocalOnly(dbUrl || 'postgresql://postgres:postgres@127.0.0.1:55432/dth_a1');

  if (opts.enableDisk) {
    diskRoot = '/tmp/dth-a6-test-storage';
    mkdirSync(diskRoot, { recursive: true });
  }

  return {
    name: 'local_test_document_storage',
    getLiveCallCount() {
      return liveCallCount;
    },
    async put({ bytes, contentType, caseId }) {
      if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
        throw new Error('BYTES_REQUIRED');
      }
      const buf = Buffer.from(bytes);
      const sha256 = createHash('sha256').update(buf).digest('hex');
      const storageKey = `cases/${String(caseId || 'unknown')}/${sha256.slice(0, 16)}-${randomUUID()}.bin`;
      if (storageKey.includes('..')) throw new Error('PATH_TRAVERSAL_REJECTED');
      memory.set(storageKey, buf);
      if (diskRoot) {
        const path = safeJoinUnderRoot(diskRoot, storageKey.replace(/\//g, '__'));
        writeFileSync(path, buf);
      }
      return {
        ok: true,
        storageKey,
        sha256,
        byteSize: buf.length,
        contentType: contentType || 'application/octet-stream',
      };
    },
    async get(storageKey) {
      if (!storageKey || String(storageKey).includes('..')) {
        throw new Error('PATH_TRAVERSAL_REJECTED');
      }
      if (memory.has(storageKey)) {
        return { ok: true, bytes: Buffer.from(memory.get(storageKey)) };
      }
      if (diskRoot) {
        const path = safeJoinUnderRoot(diskRoot, String(storageKey).replace(/\//g, '__'));
        if (existsSync(path)) {
          return { ok: true, bytes: readFileSync(path) };
        }
      }
      return { ok: false, code: 'NOT_FOUND' };
    },
    async delete(storageKey) {
      if (!storageKey || String(storageKey).includes('..')) {
        throw new Error('PATH_TRAVERSAL_REJECTED');
      }
      memory.delete(storageKey);
      if (diskRoot) {
        const path = safeJoinUnderRoot(diskRoot, String(storageKey).replace(/\//g, '__'));
        if (existsSync(path)) unlinkSync(path);
      }
      return { ok: true };
    },
  };
}
