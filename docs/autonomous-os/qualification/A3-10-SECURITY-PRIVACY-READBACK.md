# A3-10 Security / Privacy Readback

- ops tables: no anon/authenticated grants (verified in A3 suite)
- No client outcome/policy/field authority
- Free text not runtime authority
- Audit: case_id, revision, outcome, counts — no PII
- Future `dth_worker` needs: SELECT/INSERT/UPDATE on ops qualification tables + existing workflow/cases/leads (document only; not granted here)
