# A6-01 Document Domain Model

Tables (ops, RLS, revoke anon/authenticated):

| Table | Role |
|---|---|
| `documents` | Immutable receipt + opaque `storage_key` + sha256 |
| `document_processing_runs` | Extractor revision; unique `processing_fingerprint` |
| `document_facts` | Candidate/accepted facts with provenance |
| `document_fact_conflicts` | Form/observation/doc contradictions |

Source kinds: `TEST_UPLOAD`, `A4_INBOUND_ATTACHMENT`.  
Statuses: RECEIVED→…→PROCESSED / HUMAN_REVIEW / FAILED / DELETED.  
Unique: `(case_id, sha256)` where status ≠ DELETED.
