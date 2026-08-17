# A6-02 Ingestion Validation

Authority: magic bytes (`%PDF-`), not extension.  
Reject: empty, size > `TEST_MAX_DOCUMENT_BYTES` (2e6), MZ/ELF executables, path traversal filenames, extension claim without magic.

Malware adapter: `CLEAN` only when scanned or explicit test mode; default `UNSCANNED` never claimed CLEAN.
