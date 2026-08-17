-- DTH-A6 Document Intelligence (local additive, ops private)
-- No live storage/OCR/AI. No staging/production apply.

BEGIN;

CREATE SCHEMA IF NOT EXISTS ops;
REVOKE ALL ON SCHEMA ops FROM PUBLIC;

CREATE TABLE IF NOT EXISTS ops.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  source_kind text NOT NULL CHECK (source_kind = ANY (ARRAY[
    'TEST_UPLOAD',
    'A4_INBOUND_ATTACHMENT'
  ])),
  inbound_event_id uuid,
  filename_sanitized text NOT NULL,
  content_type text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size >= 0),
  sha256 text NOT NULL,
  storage_key text NOT NULL,
  status text NOT NULL DEFAULT 'RECEIVED' CHECK (status = ANY (ARRAY[
    'RECEIVED','VALIDATING','REJECTED','STORED','PROCESSING','PROCESSED',
    'AMBIGUOUS','HUMAN_REVIEW','FAILED','SUPERSEDED','DELETED'
  ])),
  document_type text NOT NULL DEFAULT 'UNKNOWN_DOCUMENT' CHECK (document_type = ANY (ARRAY[
    'ELECTRICITY_INVOICE','GAS_INVOICE','ENERGY_SUPPLY_CONTRACT','CONTRACT_CONFIRMATION',
    'METER_INFORMATION','OTHER_ENERGY_DOCUMENT','UNKNOWN_DOCUMENT'
  ])),
  attachment_present boolean NOT NULL DEFAULT true,
  exception_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_case_idx ON ops.documents (case_id);
CREATE INDEX IF NOT EXISTS documents_status_idx ON ops.documents (status);
CREATE INDEX IF NOT EXISTS documents_sha256_idx ON ops.documents (sha256);

-- Same content hash may exist across cases; within one case only one non-deleted row.
CREATE UNIQUE INDEX IF NOT EXISTS documents_case_sha256_active_uniq
  ON ops.documents (case_id, sha256)
  WHERE status <> 'DELETED';

CREATE TABLE IF NOT EXISTS ops.document_processing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES ops.documents(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision >= 1),
  status text NOT NULL DEFAULT 'RUNNING' CHECK (status = ANY (ARRAY[
    'RUNNING','COMPLETED','FAILED','SUPERSEDED','BLOCKED'
  ])),
  extractor_id text NOT NULL,
  extractor_version text NOT NULL,
  classification_method text,
  processing_fingerprint text NOT NULL,
  text_extracted boolean NOT NULL DEFAULT false,
  ocr_status text NOT NULL DEFAULT 'NOT_REQUIRED' CHECK (ocr_status = ANY (ARRAY[
    'NOT_REQUIRED','REQUIRED','NOT_AVAILABLE','FAILED','COMPLETED'
  ])),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (processing_fingerprint),
  UNIQUE (document_id, revision)
);

CREATE INDEX IF NOT EXISTS document_processing_runs_document_idx
  ON ops.document_processing_runs (document_id);

CREATE TABLE IF NOT EXISTS ops.document_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  document_id uuid NOT NULL REFERENCES ops.documents(id) ON DELETE CASCADE,
  processing_run_id uuid NOT NULL REFERENCES ops.document_processing_runs(id) ON DELETE CASCADE,
  fact_code text NOT NULL,
  value_type text NOT NULL CHECK (value_type = ANY (ARRAY[
    'TEXT','INTEGER','DECIMAL','DATE','IDENTIFIER','ENUM'
  ])),
  raw_value text,
  normalized_value text,
  unit text,
  status text NOT NULL DEFAULT 'CANDIDATE' CHECK (status = ANY (ARRAY[
    'CANDIDATE','ACCEPTED','AMBIGUOUS','CONFLICTING','REJECTED','SUPERSEDED','HUMAN_VERIFIED'
  ])),
  source_page integer,
  evidence_span text,
  extraction_method text NOT NULL,
  extractor_version text NOT NULL,
  confidence_class text NOT NULL CHECK (confidence_class = ANY (ARRAY[
    'EXACT_LABEL_MATCH','STRUCTURAL_MATCH','HEURISTIC','AMBIGUOUS'
  ])),
  created_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz
);

CREATE INDEX IF NOT EXISTS document_facts_case_idx ON ops.document_facts (case_id);
CREATE INDEX IF NOT EXISTS document_facts_document_idx ON ops.document_facts (document_id);
CREATE INDEX IF NOT EXISTS document_facts_run_idx ON ops.document_facts (processing_run_id);
CREATE INDEX IF NOT EXISTS document_facts_code_status_idx
  ON ops.document_facts (case_id, fact_code, status);

CREATE TABLE IF NOT EXISTS ops.document_fact_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  fact_code text NOT NULL,
  left_fact_id uuid REFERENCES ops.document_facts(id) ON DELETE SET NULL,
  right_fact_id uuid REFERENCES ops.document_facts(id) ON DELETE SET NULL,
  left_source text NOT NULL,
  right_source text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status = ANY (ARRAY[
    'OPEN','RESOLVED','SUPERSEDED'
  ])),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_fact_conflicts_case_idx
  ON ops.document_fact_conflicts (case_id);

COMMENT ON TABLE ops.documents IS 'A6 immutable document receipt + storage reference; no bytes in row';
COMMENT ON TABLE ops.document_processing_runs IS 'A6 extraction revision; fingerprint unique for idempotent process';
COMMENT ON TABLE ops.document_facts IS 'A6 candidate/accepted facts with provenance; never invent values';
COMMENT ON TABLE ops.document_fact_conflicts IS 'A6 unresolved contradictions vs form/observations/other docs';

DO $$
BEGIN
  EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM PUBLIC';
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM authenticated';
  END IF;
END $$;

ALTER TABLE ops.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.document_processing_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.document_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.document_fact_conflicts ENABLE ROW LEVEL SECURITY;

COMMIT;
