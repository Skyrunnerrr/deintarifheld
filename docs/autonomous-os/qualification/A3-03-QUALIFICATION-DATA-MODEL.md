# A3-03 Qualification Data Model

Schema: `ops` (private)

- `ops.case_qualifications` — revisioned assessments; one `is_current` per case
- `ops.qualification_requirements` — OPEN/RESOLVED/SUPERSEDED/CANCELLED; unique OPEN per (case, field)
- `ops.qualification_observations` — idempotent inbound facts for A4

Authorities:

- CASE_STATE_AUTHORITY: `public.cases.status` (coarse; remains `open`)
- QUALIFICATION_STATE_AUTHORITY: `ops.case_qualifications.outcome`
- WORKFLOW_STATE_AUTHORITY: `workflow.workflow_instances.current_state`
