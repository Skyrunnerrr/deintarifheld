/**
 * A6 document ingestion + processing pipeline.
 * Kill: DATA_IMPORT for document processing. Receipt may succeed under global kill.
 * No tariff/savings/offer logic. LIVE storage/OCR/AI/email = 0.
 */
import { createHash } from 'node:crypto';
import {
  KillDomain,
  DocumentSourceKind,
  DocumentStatus,
  DocumentType,
  DocumentFactStatus,
  DocumentFactCode,
  DocumentFactsReadiness,
  OcrStatus,
  A6_EXTRACTOR_ID,
  A6_EXTRACTOR_VERSION,
  DOCUMENT_PROCESS_CAPABILITY,
  ENERGY_TARIFF_EVALUATION_PREPARE_HANDOFF,
  FieldCode,
  CanonicalEnergyType,
  TEST_MAX_DOCUMENT_BYTES,
} from '@deintarifheld/shared';
import { readFreshControlSnapshot } from '../workflow/control.js';
import { createFollowOnJob } from '../workflow/instances.js';
import { createLocalTestDocumentStorage } from './storage.js';
import { validateDocumentBytes } from './validate.js';
import { extractTextFromPdfBytes } from './pdf-text.js';
import { classifyDocumentText } from './classify.js';
import { extractFactsFromText } from './extract-facts.js';
import { createDocumentMalwareScanner } from './malware.js';
import { parseConsumptionKwh } from '../a3/normalize.js';

async function documentControlGate(pool) {
  try {
    const snap = await readFreshControlSnapshot(pool, { domain: KillDomain.DATA_IMPORT });
    if (!snap.mayClaim || snap.globalKillActive || snap.domainKillActive) {
      return {
        ok: false,
        code: snap.globalKillActive ? 'GLOBAL_KILL' : 'DOCUMENT_DOMAIN_KILL',
        snap,
      };
    }
    return { ok: true, snap };
  } catch (err) {
    if (err?.code === 'CONTROL_STATE_UNAVAILABLE' || /CONTROL_STATE_UNAVAILABLE/.test(String(err?.message || ''))) {
      return { ok: false, code: 'CONTROL_UNAVAILABLE' };
    }
    throw err;
  }
}

async function hasTakeover(pool, caseId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM security.control_state
     WHERE scope = 'WORKFLOW' AND state = 'TAKEOVER'
       AND scope_key IN (SELECT id::text FROM workflow.workflow_instances WHERE case_id = $1)
     LIMIT 1`,
    [caseId],
  );
  return rows.length > 0;
}

function sha256Hex(bytes) {
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

function processingFingerprint({ documentId, sha256, extractorId, extractorVersion, revision }) {
  return createHash('sha256')
    .update(
      [
        String(documentId),
        String(sha256),
        String(extractorId),
        String(extractorVersion),
        String(revision),
      ].join('|'),
    )
    .digest('hex');
}

/**
 * Ingest a test upload. Receipt is durable even under global kill; processing is not.
 */
export async function ingestTestDocument(pool, {
  caseId,
  bytes,
  filename = 'document.pdf',
  contentType = 'application/pdf',
  storage = null,
  malwareScanner = null,
  enqueueProcess = true,
  maxBytes = TEST_MAX_DOCUMENT_BYTES,
} = {}) {
  if (!caseId) return { ok: false, code: 'CASE_ID_REQUIRED' };

  const { rows: cases } = await pool.query(
    `SELECT id FROM public.cases WHERE id = $1 AND deleted_at IS NULL`,
    [caseId],
  );
  if (!cases[0]) return { ok: false, code: 'CASE_MISSING' };

  const validation = validateDocumentBytes({ bytes, filename, contentType, maxBytes });
  if (!validation.ok) {
    return { ok: false, code: validation.code, receipt: false };
  }

  const scanner = malwareScanner || createDocumentMalwareScanner();
  const scan = await scanner.scan(bytes);
  if (scan.result === 'INFECTED') {
    return { ok: false, code: 'MALWARE_DETECTED', receipt: false };
  }

  const hash = sha256Hex(bytes);

  // Duplicate same case + hash — check before storage write (no orphan object)
  const { rows: dup } = await pool.query(
    `SELECT id, status FROM ops.documents
     WHERE case_id = $1 AND sha256 = $2 AND status <> 'DELETED'
     LIMIT 1`,
    [caseId, hash],
  );
  if (dup[0]) {
    return {
      ok: true,
      duplicate: true,
      documentId: dup[0].id,
      status: dup[0].status,
      sha256: hash,
      receipt: true,
    };
  }

  const store = storage || createLocalTestDocumentStorage();
  const put = await store.put({
    bytes: Buffer.from(bytes),
    contentType: validation.contentType,
    caseId,
  });

  const { rows } = await pool.query(
    `INSERT INTO ops.documents
      (case_id, source_kind, filename_sanitized, content_type, byte_size, sha256,
       storage_key, status, document_type, attachment_present)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'STORED','UNKNOWN_DOCUMENT', true)
     RETURNING *`,
    [
      caseId,
      DocumentSourceKind.TEST_UPLOAD,
      validation.filenameSanitized,
      validation.contentType,
      validation.byteSize,
      hash,
      put.storageKey,
    ],
  );
  const doc = rows[0];

  const gate = await documentControlGate(pool);
  const takeover = await hasTakeover(pool, caseId);
  let processJobId = null;
  let processingBlocked = null;

  if (!gate.ok) {
    processingBlocked = gate.code;
  } else if (takeover) {
    processingBlocked = 'TAKEOVER';
  } else if (enqueueProcess) {
    processJobId = await ensureDocumentProcessJob(pool, {
      caseId,
      documentId: doc.id,
      controlVersion: gate.snap?.controlVersion,
    });
  }

  return {
    ok: true,
    documentId: doc.id,
    status: DocumentStatus.STORED,
    sha256: hash,
    storageKey: put.storageKey,
    receipt: true,
    scanResult: scan.result,
    processJobId,
    processingBlocked,
    liveStorageCalls: store.getLiveCallCount?.() ?? 0,
  };
}

/**
 * Mock A4 attachment handoff — metadata + mock retrieve bytes (no live provider).
 */
export async function acceptA4AttachmentHandoff(pool, {
  caseId,
  inboundEventId,
  filename = 'attachment.pdf',
  contentType = 'application/pdf',
  mockBytes = null,
  storage = null,
  enqueueProcess = true,
} = {}) {
  if (!caseId) return { ok: false, code: 'CASE_ID_REQUIRED' };
  if (!inboundEventId) return { ok: false, code: 'INBOUND_EVENT_ID_REQUIRED' };
  if (!mockBytes) return { ok: false, code: 'MOCK_BYTES_REQUIRED' };

  const { rows: inbound } = await pool.query(
    `SELECT id, case_id, conversation_id, attachment_count FROM ops.inbound_events WHERE id = $1`,
    [inboundEventId],
  ).catch(() => ({ rows: [] }));

  if (inbound[0]?.case_id && String(inbound[0].case_id) !== String(caseId)) {
    return { ok: false, code: 'WRONG_CASE_ATTACHMENT' };
  }

  const ingested = await ingestTestDocument(pool, {
    caseId,
    bytes: mockBytes,
    filename,
    contentType,
    storage,
    enqueueProcess: false,
  });
  if (!ingested.ok && !ingested.duplicate) return ingested;

  const documentId = ingested.documentId;
  await pool.query(
    `UPDATE ops.documents
     SET source_kind = $2, inbound_event_id = $3, updated_at = now()
     WHERE id = $1`,
    [documentId, DocumentSourceKind.A4_INBOUND_ATTACHMENT, inboundEventId],
  );

  let processJobId = null;
  let processingBlocked = null;
  const gate = await documentControlGate(pool);
  if (!gate.ok) {
    processingBlocked = gate.code;
  } else if (await hasTakeover(pool, caseId)) {
    processingBlocked = 'TAKEOVER';
  } else if (enqueueProcess) {
    processJobId = await ensureDocumentProcessJob(pool, {
      caseId,
      documentId,
      controlVersion: gate.snap?.controlVersion,
    });
  }

  return {
    ok: true,
    documentId,
    sourceKind: DocumentSourceKind.A4_INBOUND_ATTACHMENT,
    inboundEventId,
    processJobId,
    processingBlocked,
    duplicate: Boolean(ingested.duplicate),
    sha256: ingested.sha256,
  };
}

export async function prepareDocumentIntelligence(pool, { caseId, documentId = null } = {}) {
  if (!caseId) return { ok: false, code: 'CASE_ID_REQUIRED' };
  const gate = await documentControlGate(pool);
  if (!gate.ok) return { ok: false, code: gate.code };
  if (await hasTakeover(pool, caseId)) return { ok: false, code: 'TAKEOVER' };

  let docs;
  if (documentId) {
    const { rows } = await pool.query(
      `SELECT * FROM ops.documents WHERE id = $1 AND case_id = $2 AND status <> 'DELETED'`,
      [documentId, caseId],
    );
    docs = rows;
  } else {
    const { rows } = await pool.query(
      `SELECT * FROM ops.documents
       WHERE case_id = $1 AND status IN ('STORED','RECEIVED','FAILED','AMBIGUOUS','HUMAN_REVIEW')
       ORDER BY created_at ASC`,
      [caseId],
    );
    docs = rows;
  }

  const jobs = [];
  for (const d of docs) {
    const jobId = await ensureDocumentProcessJob(pool, {
      caseId,
      documentId: d.id,
      controlVersion: gate.snap?.controlVersion,
    });
    jobs.push({ documentId: d.id, jobId });
  }
  return { ok: true, jobs, handoff: ENERGY_TARIFF_EVALUATION_PREPARE_HANDOFF };
}

async function ensureDocumentProcessJob(pool, { caseId, documentId, controlVersion }) {
  const { rows: wfs } = await pool.query(
    `SELECT id, control_version_at_start FROM workflow.workflow_instances
     WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [caseId],
  );
  if (!wfs[0]) return null;
  const cv = controlVersion ?? wfs[0].control_version_at_start;
  const idem = `doc-process:${documentId}:${A6_EXTRACTOR_VERSION}`;
  const job = await createFollowOnJob(pool, {
    workflowInstanceId: wfs[0].id,
    jobType: DOCUMENT_PROCESS_CAPABILITY,
    idempotencyKey: idem,
    correlationId: `a6:${caseId}`,
    controlVersion: cv,
    payloadRedacted: {
      case_id: String(caseId),
      document_id: String(documentId),
      schema_version: 1,
    },
  });
  return job?.id || null;
}

/**
 * Process one document: extract → classify → facts → conflicts.
 */
export async function processDocument(pool, {
  documentId,
  storage = null,
  forceReprocess = false,
  extractorVersion = A6_EXTRACTOR_VERSION,
} = {}) {
  if (!documentId) return { ok: false, code: 'DOCUMENT_ID_REQUIRED' };

  const { rows: docs } = await pool.query(`SELECT * FROM ops.documents WHERE id = $1`, [documentId]);
  const doc = docs[0];
  if (!doc) return { ok: false, code: 'DOCUMENT_MISSING' };
  if (doc.status === DocumentStatus.DELETED) return { ok: false, code: 'DOCUMENT_DELETED' };

  const gate = await documentControlGate(pool);
  if (!gate.ok) {
    return { ok: false, code: gate.code, receiptOk: true, documentId };
  }
  if (await hasTakeover(pool, doc.case_id)) {
    return { ok: false, code: 'TAKEOVER', receiptOk: true, documentId };
  }

  const store = storage || createLocalTestDocumentStorage();
  const got = await store.get(doc.storage_key);
  if (!got.ok) {
    await pool.query(
      `UPDATE ops.documents SET status='FAILED', exception_code='STORAGE_MISSING', updated_at=now() WHERE id=$1`,
      [documentId],
    );
    return { ok: false, code: 'STORAGE_MISSING' };
  }

  const { rows: revRows } = await pool.query(
    `SELECT COALESCE(MAX(revision), 0)::int AS r FROM ops.document_processing_runs WHERE document_id = $1`,
    [documentId],
  );
  const nextRevision = (revRows[0]?.r || 0) + 1;
  const fp = processingFingerprint({
    documentId,
    sha256: doc.sha256,
    extractorId: A6_EXTRACTOR_ID,
    extractorVersion,
    revision: forceReprocess ? nextRevision : 1,
  });

  // Idempotent: existing fingerprint
  const { rows: existingFp } = await pool.query(
    `SELECT * FROM ops.document_processing_runs WHERE processing_fingerprint = $1`,
    [fp],
  );
  if (existingFp[0] && !forceReprocess) {
    return {
      ok: true,
      duplicateRun: true,
      runId: existingFp[0].id,
      documentId,
      status: doc.status,
    };
  }

  const revision = forceReprocess ? nextRevision : existingFp[0] ? nextRevision : 1;
  const fingerprint = forceReprocess
    ? processingFingerprint({
        documentId,
        sha256: doc.sha256,
        extractorId: A6_EXTRACTOR_ID,
        extractorVersion,
        revision,
      })
    : fp;

  await pool.query(
    `UPDATE ops.documents SET status='PROCESSING', updated_at=now() WHERE id=$1`,
    [documentId],
  );

  const { rows: runRows } = await pool.query(
    `INSERT INTO ops.document_processing_runs
      (document_id, revision, status, extractor_id, extractor_version, processing_fingerprint,
       text_extracted, ocr_status)
     VALUES ($1,$2,'RUNNING',$3,$4,$5,false,'NOT_REQUIRED')
     RETURNING *`,
    [documentId, revision, A6_EXTRACTOR_ID, extractorVersion, fingerprint],
  );
  const run = runRows[0];

  // Supersede prior facts on reprocess
  if (forceReprocess || revision > 1) {
    await pool.query(
      `UPDATE ops.document_facts
       SET status='SUPERSEDED', superseded_at=now()
       WHERE document_id = $1 AND status IN ('CANDIDATE','ACCEPTED','AMBIGUOUS','CONFLICTING')`,
      [documentId],
    );
    await pool.query(
      `UPDATE ops.document_processing_runs
       SET status='SUPERSEDED'
       WHERE document_id = $1 AND id <> $2 AND status IN ('COMPLETED','RUNNING')`,
      [documentId, run.id],
    );
  }

  const extracted = extractTextFromPdfBytes(got.bytes);
  if (!extracted.ok) {
    await pool.query(
      `UPDATE ops.document_processing_runs
       SET status='FAILED', error_code=$2, completed_at=now() WHERE id=$1`,
      [run.id, extracted.code],
    );
    await pool.query(
      `UPDATE ops.documents SET status='FAILED', exception_code=$2, updated_at=now() WHERE id=$1`,
      [documentId, extracted.code],
    );
    return { ok: false, code: extracted.code, runId: run.id };
  }

  if (!extracted.textExtracted) {
    await pool.query(
      `UPDATE ops.document_processing_runs
       SET status='COMPLETED', text_extracted=false, ocr_status='REQUIRED',
           classification_method='EMPTY_TEXT', completed_at=now()
       WHERE id=$1`,
      [run.id],
    );
    await pool.query(
      `UPDATE ops.documents
       SET status='HUMAN_REVIEW', document_type='UNKNOWN_DOCUMENT',
           exception_code='OCR_REQUIRED', updated_at=now()
       WHERE id=$1`,
      [documentId],
    );
    return {
      ok: true,
      documentId,
      runId: run.id,
      ocrStatus: OcrStatus.REQUIRED,
      code: 'OCR_REQUIRED',
      status: DocumentStatus.HUMAN_REVIEW,
      facts: [],
    };
  }

  const classification = classifyDocumentText(extracted.text);
  const rawFacts = extractFactsFromText(extracted.text, { documentType: classification.documentType });

  // Accept candidates that are well-formed; mark ambiguous as-is
  const persisted = [];
  for (const f of rawFacts) {
    const status =
      f.status === 'AMBIGUOUS'
        ? DocumentFactStatus.AMBIGUOUS
        : DocumentFactStatus.ACCEPTED;
    const { rows: fr } = await pool.query(
      `INSERT INTO ops.document_facts
        (case_id, document_id, processing_run_id, fact_code, value_type, raw_value,
         normalized_value, unit, status, source_page, evidence_span, extraction_method,
         extractor_version, confidence_class)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        doc.case_id,
        documentId,
        run.id,
        f.fact_code,
        f.value_type,
        f.raw_value,
        f.normalized_value,
        f.unit,
        status,
        f.source_page,
        f.evidence_span,
        f.extraction_method,
        f.extractor_version,
        f.confidence_class,
      ],
    );
    persisted.push(fr[0]);
  }

  const conflicts = await detectFactConflicts(pool, {
    caseId: doc.case_id,
    documentId,
    facts: persisted,
  });

  let finalStatus = DocumentStatus.PROCESSED;
  if (conflicts.length > 0) finalStatus = DocumentStatus.AMBIGUOUS;
  if (classification.documentType === DocumentType.UNKNOWN_DOCUMENT && persisted.length === 0) {
    finalStatus = DocumentStatus.HUMAN_REVIEW;
  }

  await pool.query(
    `UPDATE ops.document_processing_runs
     SET status='COMPLETED', text_extracted=true, ocr_status='NOT_REQUIRED',
         classification_method=$2, completed_at=now()
     WHERE id=$1`,
    [run.id, classification.method],
  );
  await pool.query(
    `UPDATE ops.documents
     SET status=$2, document_type=$3, exception_code=NULL, updated_at=now()
     WHERE id=$1`,
    [documentId, finalStatus, classification.documentType],
  );

  return {
    ok: true,
    documentId,
    runId: run.id,
    revision,
    processingFingerprint: fingerprint,
    documentType: classification.documentType,
    status: finalStatus,
    facts: persisted,
    conflicts,
    ocrStatus: OcrStatus.NOT_REQUIRED,
    textExtracted: true,
    // Explicit non-goals
    savingsCalculations: 0,
    tariffRankings: 0,
    offerDocumentsCreated: 0,
  };
}

export async function reprocessDocument(pool, { documentId, storage = null, extractorVersion = A6_EXTRACTOR_VERSION } = {}) {
  return processDocument(pool, {
    documentId,
    storage,
    forceReprocess: true,
    extractorVersion,
  });
}

/**
 * Detect conflicts vs form fields / qualification observations / other document facts.
 */
export async function detectFactConflicts(pool, { caseId, documentId, facts }) {
  const conflicts = [];
  const bag = await loadFormFieldBag(pool, caseId);

  for (const f of facts) {
    if (f.status === DocumentFactStatus.AMBIGUOUS || !f.normalized_value) continue;

    let formValue = null;
    let formSource = 'FORM_FIELD';
    if (f.fact_code === DocumentFactCode.ANNUAL_CONSUMPTION_KWH) {
      const energy = facts.find((x) => x.fact_code === DocumentFactCode.ENERGY_TYPE);
      const isGas = energy?.normalized_value === CanonicalEnergyType.GAS
        || bag.energieart === 'Gas';
      const raw = isGas ? bag.verbrauchGas : bag.verbrauchStrom;
      const parsed = parseConsumptionKwh(raw);
      if (parsed.status === 'OK') {
        formValue = String(parsed.valueKwh);
        formSource = bag._obs?.[isGas ? FieldCode.VERBRAUCH_GAS : FieldCode.VERBRAUCH_STROM]
          ? 'QUALIFICATION_OBSERVATION'
          : 'FORM_FIELD';
      }
    } else if (f.fact_code === DocumentFactCode.PLZ && bag.plz) {
      formValue = String(bag.plz);
    } else if (f.fact_code === DocumentFactCode.SUPPLIER_NAME && bag.versorger) {
      formValue = String(bag.versorger);
    } else if (f.fact_code === DocumentFactCode.ENERGY_TYPE && bag.energieart) {
      formValue =
        bag.energieart === 'Strom'
          ? CanonicalEnergyType.ELECTRICITY
          : bag.energieart === 'Gas'
            ? CanonicalEnergyType.GAS
            : null;
    }

    if (formValue != null && String(formValue) !== String(f.normalized_value)) {
      const { rows } = await pool.query(
        `INSERT INTO ops.document_fact_conflicts
          (case_id, fact_code, left_fact_id, right_fact_id, left_source, right_source, status)
         VALUES ($1,$2,$3,NULL,$4,$5,'OPEN')
         RETURNING *`,
        [caseId, f.fact_code, f.id, 'DOCUMENT_FACT', formSource],
      );
      await pool.query(
        `UPDATE ops.document_facts SET status='CONFLICTING' WHERE id=$1`,
        [f.id],
      );
      conflicts.push(rows[0]);
    }
  }

  // Cross-document conflicts for same fact_code
  for (const f of facts) {
    if (!f.normalized_value) continue;
    const { rows: others } = await pool.query(
      `SELECT * FROM ops.document_facts
       WHERE case_id = $1 AND fact_code = $2 AND document_id <> $3
         AND status IN ('ACCEPTED','HUMAN_VERIFIED')
         AND normalized_value IS NOT NULL
         AND normalized_value <> $4
       LIMIT 5`,
      [caseId, f.fact_code, documentId, f.normalized_value],
    );
    for (const o of others) {
      const { rows } = await pool.query(
        `INSERT INTO ops.document_fact_conflicts
          (case_id, fact_code, left_fact_id, right_fact_id, left_source, right_source, status)
         VALUES ($1,$2,$3,$4,'DOCUMENT_FACT','DOCUMENT_FACT','OPEN')
         RETURNING *`,
        [caseId, f.fact_code, f.id, o.id],
      );
      await pool.query(
        `UPDATE ops.document_facts SET status='CONFLICTING' WHERE id = ANY($1::uuid[])`,
        [[f.id, o.id]],
      );
      conflicts.push(rows[0]);
    }
  }

  return conflicts;
}

async function loadFormFieldBag(pool, caseId) {
  const { rows: cases } = await pool.query(
    `SELECT source_lead_id FROM public.cases WHERE id = $1`,
    [caseId],
  );
  const bag = {
    plz: '',
    energieart: '',
    verbrauchStrom: '',
    verbrauchGas: '',
    versorger: '',
    _obs: {},
  };
  if (!cases[0]?.source_lead_id) return bag;
  const { rows: leads } = await pool.query(
    `SELECT payload FROM public.leads WHERE id = $1`,
    [cases[0].source_lead_id],
  );
  const payload = leads[0]?.payload || {};
  bag.plz = payload.plz || '';
  bag.energieart = payload.energieart || '';
  bag.verbrauchStrom = payload.verbrauchStrom || '';
  bag.verbrauchGas = payload.verbrauchGas || '';
  bag.versorger = payload.versorger || '';

  const { rows: obs } = await pool.query(
    `SELECT field_code, value_text FROM ops.qualification_observations
     WHERE case_id = $1 ORDER BY created_at ASC`,
    [caseId],
  );
  for (const o of obs) {
    bag._obs[o.field_code] = true;
    if (o.field_code === FieldCode.PLZ) bag.plz = o.value_text || bag.plz;
    if (o.field_code === FieldCode.ENERGIEART) bag.energieart = o.value_text || bag.energieart;
    if (o.field_code === FieldCode.VERBRAUCH_STROM) bag.verbrauchStrom = o.value_text || bag.verbrauchStrom;
    if (o.field_code === FieldCode.VERBRAUCH_GAS) bag.verbrauchGas = o.value_text || bag.verbrauchGas;
    if (o.field_code === FieldCode.VERSORGER) bag.versorger = o.value_text || bag.versorger;
  }
  return bag;
}

/**
 * A7 handoff: structured energy evidence. No raw bytes / parser internals.
 */
export async function getCaseEnergyEvidence(pool, caseId) {
  if (!caseId) throw new Error('CASE_ID_REQUIRED');

  const { rows: docs } = await pool.query(
    `SELECT id, status, document_type, source_kind, filename_sanitized, sha256,
            exception_code, created_at, updated_at
     FROM ops.documents
     WHERE case_id = $1 AND status <> 'DELETED'
     ORDER BY created_at ASC`,
    [caseId],
  );

  const { rows: facts } = await pool.query(
    `SELECT id, document_id, fact_code, value_type, normalized_value, unit, status,
            confidence_class, evidence_span, extractor_version, created_at
     FROM ops.document_facts
     WHERE case_id = $1 AND status IN ('ACCEPTED','HUMAN_VERIFIED','AMBIGUOUS','CONFLICTING')
       AND superseded_at IS NULL
     ORDER BY created_at ASC`,
    [caseId],
  );

  const { rows: conflicts } = await pool.query(
    `SELECT id, fact_code, left_source, right_source, status, created_at
     FROM ops.document_fact_conflicts
     WHERE case_id = $1 AND status = 'OPEN'`,
    [caseId],
  );

  const accepted = facts.filter((f) => f.status === 'ACCEPTED' || f.status === 'HUMAN_VERIFIED');
  const unresolvedConflicts = conflicts;
  const missingEvidence = [];
  if (!docs.length) missingEvidence.push('NO_DOCUMENTS');
  if (docs.some((d) => d.exception_code === 'OCR_REQUIRED')) missingEvidence.push('OCR_REQUIRED');
  if (facts.some((f) => f.status === 'AMBIGUOUS')) missingEvidence.push('AMBIGUOUS_FACTS');

  let readiness = DocumentFactsReadiness.NO_DOCUMENTS;
  if (docs.length) {
    if (unresolvedConflicts.length || docs.some((d) => d.status === 'HUMAN_REVIEW')) {
      readiness = DocumentFactsReadiness.DOCUMENT_REVIEW_REQUIRED;
    } else if (accepted.length > 0 && missingEvidence.length === 0) {
      readiness = DocumentFactsReadiness.DOCUMENT_FACTS_READY;
    } else {
      readiness = DocumentFactsReadiness.DOCUMENT_FACTS_PARTIAL;
    }
  }

  return {
    caseId,
    facts: accepted.map((f) => ({
      factCode: f.fact_code,
      valueType: f.value_type,
      value: f.normalized_value,
      unit: f.unit,
      status: f.status,
      confidenceClass: f.confidence_class,
      documentId: f.document_id,
      evidenceSpan: f.evidence_span,
      extractorVersion: f.extractor_version,
    })),
    unresolvedConflicts: unresolvedConflicts.map((c) => ({
      id: c.id,
      factCode: c.fact_code,
      leftSource: c.left_source,
      rightSource: c.right_source,
      status: c.status,
    })),
    missingEvidence,
    documentSummaries: docs.map((d) => ({
      documentId: d.id,
      status: d.status,
      documentType: d.document_type,
      sourceKind: d.source_kind,
      filename: d.filename_sanitized,
      sha256: d.sha256,
      exceptionCode: d.exception_code,
    })),
    readiness,
    nextCapability: ENERGY_TARIFF_EVALUATION_PREPARE_HANDOFF,
    // Explicit inequalities
    tariffReady: false,
    savingsCalculated: false,
    offerReady: false,
  };
}
