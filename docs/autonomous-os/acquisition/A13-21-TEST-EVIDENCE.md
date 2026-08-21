# A13-21 Test Evidence

## Suite

`npm run test:dth:a13` — **9/9 pass** (logical coverage A13-01…A13-47 + E2E organic loop + stress BOUNDED).

Critical invariants all **0** at close of suite.

## A13R — Post-implementation regression closure

Task: `REMEDIATE_ONLY_PROVEN_A13_EVIDENCE_GAP`  
Source tip during proof: `f6f9ebd605226f16b9d4de89372dd7920d27c963`  
Source mutation during A13R: **NONE** (evidence docs only)

### Isolated A1–A3 after local disposable wipe

Quiet baseline: `wipeOfferAndSwitchingDomain` + cases/outbox/leads/jobs clear on `127.0.0.1:55432/dth_a1`.

| Suite | Run 1 | Run 2 |
|-------|-------|-------|
| `test:dth:a1` | **39/39** | — |
| `test:dth:a2` | **16/16** | **16/16** |
| `test:dth:a3` | **18/18** | **18/18** |

Prior sequential/polluted-DB recordings of A2=`14/16` and A3=`17/18` remain historical. Classification:

`A1_A3_SEQUENTIAL_HARNESS_CLASSIFICATION=HARNESS_ISOLATION_FLAKE_PREEXISTING`

`A13_CAUSED_A1_A12_REGRESSIONS=0`

### POST-A13 domain regression (after final wipe/handoff tip)

| Key | Result |
|-----|--------|
| POST_A13_A13 | PASS_9_9 |
| POST_A13_A12 | PASS_13_13 |
| POST_A13_A11 | PASS_15_15 |
| POST_A13_A10 | PASS_18_18 |
| POST_A13_A9 | PASS_24_24 |
| POST_A13_A8 | PASS_24_24 |
| POST_A13_A7 | PASS_25_25 |
| POST_A13_A6 | PASS_25_25 |
| POST_A13_A5 | PASS_15_15 |
| POST_A13_A4 | PASS_23_23 |
| POST_A13_A3 | PASS_ISOLATED_18_18 |
| POST_A13_A2 | PASS_ISOLATED_16_16 |
| POST_A13_A1 | PASS_ISOLATED_39_39 |

### Platform (canonical scripts)

| Surface | Result |
|---------|--------|
| Command Center (`cc:ui:test`) | PASS |
| Ops API (`ops:bff:test`) | PASS |
| Kill/control (`kill:test`) | PASS |
| AuthN (`authn:test`) | PASS |
| Workers (`workers:test`) | PASS |
| DB draft (`db:draft:test`) | PASS |
| Shared (`test -w @deintarifheld/shared`) | PASS 76/76 |
| Lead (`leads:contract`) | PASS |
| Boundary (`packages:boundary:check`) | PASS |
| Lint | PASS (preexisting warnings only) |
| Build (`NEXT_DIST_DIR=.next-a13r-closure`) | PASS |
| M11 named regression script | **NOT_PRESENT** (ops grant / private-schema coverage via A13-01 + A4/A6/A7 grants + boundary) |

Mail: covered by A4 suite PASS_23_23 + `MAIL_FAILURE_PATH_TESTABLE=YES` in leads contract; no live send (`LIVE_EMAIL_SENDS=0`).

### Intake / A12 / A11 (covered by final `test:dth:a13` 9/9)

- Tracked / untracked / forged `acq_ref` → lead accepted; forged never credits
- Soft-fail attribution → lead preserved
- A2 handoff via existing path; `ACQUISITION_DIRECT_CASE_CREATIONS=0`
- Unsupported savings / claim gate blocks campaign create/provider effect
- A11 APPROVE/REJECT/ACTIVATE/PAUSE/CANCEL/RECONCILE acquisition commands + AuthZ

### Critical invariants

`A13_CRITICAL_INVARIANTS=ALL_EXPECTED_ZERO` including live spend/provider/AI and attribution forgery counters.

## Historical note (pre-A13R)

Earlier wipe-hardening pass documented A2/A3 stress failures under polluted sequential load and did **not** re-run A4–A10. That evidence gap is closed by this A13R run.
