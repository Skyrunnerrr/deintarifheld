# Risk Register

| ID | Description | Prob | Impact | Mitigation | Status |
|---|---|---|---|---|---|
| R-001 | 14 Phase-3/4 commits existed only locally | High | Critical | M3 bundle + M4 safety branch | MITIGATED |
| R-002 | `/tmp` H0b3d/H0b4 evidence lost | High | High | Persistent evidence under Application Support + M7 reconstruction | OPEN |
| R-003 | Root Next app vs `packages/web`+`packages/api` skeletons | High | High | M9 Canonical Runtime ADR | OPEN |
| R-004 | Public lead DB vs local ops DB split | High | High | M10 SoT ADR + Lead→Ops design | OPEN |
| R-005 | Customer mail disabled / domain not production-proven | Med | High | Separate mail track after AuthZ/RLS | OPEN |
| R-006 | No production Strong AuthZ | High | Critical | M13–M15 | OPEN |
| R-007 | No production RLS policies | High | Critical | M16–M17 | OPEN |
| R-008 | No durable automation runtime | High | High | M21–M24 after staging | OPEN |
| R-009 | Package/Auth tests not in CI workflow | Med | High | Add package gates to CI after architecture freeze | OPEN |
| R-010 | Server-side reCAPTCHA verification absent on Vercel API | Med | Med | Hardening tranche after M5 | OPEN |
| R-011 | Kill switches not wired to public intake | Med | Med | Persist + wire after AuthZ | OPEN |
| R-012 | Session registry process-local only | Med | Med | Durable session store with production IdP | OPEN |
| R-013 | H0b3d formal closure incomplete | Med | Med | M6 interactive readback | OPEN |
| R-014 | Legacy Google backup owner unresolved | Low | Med | Parallel compliance closure; not architecture blocker | DEFERRED |
| R-015 | Untracked `.env.local` present on workstation | Med | High | Keep untracked; chmod 600; never commit; rotate if exposure suspected | OPEN_WATCH |

Probability/Impact are qualitative owner estimates, not formal quantitative risk scores.
