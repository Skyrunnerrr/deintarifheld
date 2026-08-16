# A0 Business Capability Matrix (condensed canonical)

Legend: IMP=IMPLEMENTED · PART=PARTIAL · LOC=LOCAL_ONLY · DES=DESIGNED_ONLY · DOC=DOCUMENTED_ONLY · STUB · NI=NOT_IMPLEMENTED

| ID | Capability | Importance | Status | Ev | Gap → Tranche |
|----|------------|------------|--------|----|----|
| CAP-001 | Public B2B Landing | High | IMP | E2 | — |
| CAP-002 | Business Lead Intake | Critical | IMP | E2 | — |
| CAP-003 | Lead Validation | Critical | IMP | E2 | — |
| CAP-004 | Abuse Protection | High | PART | E2 | harden later |
| CAP-005 | Consent Capture | High | PART | E2 | forms privacy tests |
| CAP-006 | Lead Persistence | Critical | IMP | E2 | — |
| CAP-007 | Lead Dedup/Idempotency | Critical | IMP | E2 | — |
| CAP-008 | Lead Audit | Critical | IMP | E2 | — |
| CAP-009 | Customer Confirmation Mail | High | PART | E2 | A4 |
| CAP-010 | Internal Lead Notification | High | PART | E2 | A4 |
| CAP-011 | Public→Ops Durable Handoff | Critical | NI | E1 | A2 / M11T |
| CAP-012 | Automatic Case Creation | Critical | NI | E1 | A2 |
| CAP-013 | Lead→Case Correlation | Critical | NI | E1 | A2 |
| CAP-014 | Case State Machine | Critical | LOC/DES | E2 drafts | A2 |
| CAP-015–020 | Tasks/Assign/Approval/Takeover/Pause | High | LOC | E2/E3 | A1/A11 / M11O |
| CAP-021–036 | Jobs/Loop/Scheduler/Retry/DLQ/Lease/Kill/CONTROL_VERSION | Critical | NI/STUB/DOC | E2 | **A1** (+ M11O/V) |
| CAP-040–046 | Qualification / missing info / confidence | Critical | NI | E2 | A3 |
| CAP-050–060 | Communication engine | Critical | PART outbound only | E2 | A4 |
| CAP-070–078 | Calendar | High | NI | E2 | A5 |
| CAP-080–089 | Documents | High | NI | E2 | A6 |
| CAP-100–113 | Energy/Tariff deterministic engine | Critical | NI | E2 | A7 |
| CAP-120–128 | Offer engine | Critical | NI | E2 | A8 |
| CAP-130–136 | Switching | Critical | NI | E2 | A9 |
| CAP-140–146 | Lifecycle/Renewal | High | NI | E2 | A10 |
| CAP-150–164 | Command Center production | High | LOC RO | E2 | A11 |
| CAP-170–180 | Agent runtime/registry/policy | High | DES | E1 | A1+ / A3+ |
| CAP-190–196 | Content autopilot | Later | NI | E1 | A12 |
| CAP-200–206 | Acquisition autopilot | Later | NI | E2 | A13 |

Full evidence paths: see `01_A0_REPOSITORY_TRUTH.md` and `16_A0_EVIDENCE_REGISTER.md`.
