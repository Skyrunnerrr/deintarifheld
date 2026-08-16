# A0 Red Team

| ID | Hypothesis | Result | Note |
|----|------------|--------|------|
| RT-01 | Too much security before revenue | PARTIAL | Mitigated: local A1–A5 allowed; staging still gated by M11F–P |
| RT-02 | Too much revenue before durable controls | PARTIAL | Mitigated: A1 motor first; no prod autonomy without M11O/P/S |
| RT-03 | Workflow duplicates outbox | PASS | A1 must extend/reconcile outbox, not fork |
| RT-04 | Case model insufficient | PARTIAL | Draft statuses too coarse; mapping defined in state model |
| RT-05 | AI where rules safer | PASS | Tariff/state deterministic preference frozen |
| RT-06 | Agent over-complexity | PASS | Few capabilities; orchestrator deterministic |
| RT-07 | Duplicate emails on retry | FAIL risk | A1/A4 must enforce idempotent send intents |
| RT-08 | Duplicate appointments | FAIL risk | A5 reconcile-before-rebook |
| RT-09 | Prompt injection via email | FAIL risk | Untrusted inbound boundary mandatory A4 |
| RT-10 | Takeover leaves stale jobs | FAIL risk | A1 cancel-on-takeover required |
| RT-11 | Kill bypass via queued jobs | FAIL risk | A1 must check kill/CONTROL_VERSION on claim |
| RT-12 | Worker crash loses progress | FAIL risk | Leases + durable state in A1 |
| RT-13 | Lease recovery duplicates effects | FAIL risk | Idempotent providers |
| RT-14 | Status without readback | FAIL risk | Pattern already in ADR; enforce in A4/A5/A8 |
| RT-15 | LLM fabricates tariff/offer | FAIL risk | A7/A8 deterministic facts only |
| RT-16 | Case vs workflow divergence | FAIL risk | Single transition API in A1/A2 |
| RT-17 | Wrong case email match | FAIL risk | Correlation design in A4 |
| RT-18 | Follow-up after reply | FAIL risk | Cancel-on-reply in A4 |
| RT-19 | Stale marketing after accept | FAIL risk | Suppression in A8/A10 |
| RT-20 | Duplicate renewal offers | FAIL risk | A10 idempotency |
| RT-21 | Content accesses customer data | PASS if separated | A12 isolation |
| RT-22 | Acquisition leaks into inbound | PASS if separated | A13 isolation |
| RT-23 | Agent self-escalation | PASS | ADR-012 registry |
| RT-24 | Secrets in prompts | PASS | tool boundary |
| RT-25 | CC control races jobs | FAIL risk | A11 + A1 coordination |
| RT-26 | Multi-instance worker unproven | FAIL risk | A1 lease proofs |
| RT-27 | Unresolved M11 blockers | PARTIAL | Mapped into Ax; ACL-02 open |
| RT-28 | Docs≠implementation | PASS | A0 classifications ruthlessly NI/STUB |
| RT-29 | Local≠staging | PASS | labels enforced |
| RT-30 | Staging≠production | PASS | AUTONOMY_READY=NO preserved |

Material FAIL items become A1/A4/A5 acceptance criteria, not free passes.
