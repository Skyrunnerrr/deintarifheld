# ADR-01 — Selected S2 Isolation Controls (J-F-04 Closure)

STATUS=CLOSED_WITH_EVIDENCE  
TRANCHE=P3-F7  
INFERENCE_USED=NO  
OWNER_DEFERRAL=NO  

## ADR-01 decision (accepted Phase-2)

CLAIM=ADR-01 adopts S1 (evolve Ist spine + dedicated Ops CC plane) with selected S2 isolation controls; rejects full early S2 split, S3 admin bridge, and S4 greenfield.  
SOURCE_DOCUMENT=/tmp/dth-phase-2-target-architecture/08-adr-register.md  
SOURCE_SECTION=ADR-01 row  
SOURCE_STATUS=OWNER_ACCEPTED_PHASE_2  

CLAIM=ADR-01 conditions include Owner accept and Edge≠Ops credentials.  
SOURCE_DOCUMENT=/tmp/dth-phase-2-target-architecture/08-adr-register.md  
SOURCE_SECTION=ADR-01 Conditions / gates  
SOURCE_STATUS=OWNER_ACCEPTED_PHASE_2  

## Finding closed

FINDING_ID=J-F-04  
ORIGINAL_ISSUE=ADR-01 “selected S2 controls” undefined in register  
SOURCE_DOCUMENT=/tmp/dth-phase-2-target-architecture/reviews/J-architecture-consistency.md  
SOURCE_SECTION=Findings table J-F-04; Should-Fix recommendation  
SOURCE_STATUS=OWNER_ACCEPTED_PHASE_2  

The Review-J Should-Fix explicitly lists the minimum selected controls to footnote under ADR-01.  
Those controls are documented below without adding new names.

## Selected S2 controls (exactly 4)

### S2-C1 — Edge ≠ Ops credentials

CONTROL_ID_OR_CANONICAL_NAME=Edge≠Ops credentials  
CONTROL_PURPOSE=Keep public/edge intake credentials and surfaces separate from Ops/Command-Center authz.  
CONTROL_BOUNDARY=Edge intake authentication/authorization must not be the CC/ops session plane.  
PHASE_3_IMPLEMENTATION_REFERENCE=P3-F1 person CC session + P3-F3 `/ops/v1` person-session gate; shared-secret rejected as CC session  
CURRENT_STATUS=DESIGN_AND_LOCAL_FOUNDATION_REFLECTED  
SOURCE_EVIDENCE=
- /tmp/dth-phase-2-target-architecture/08-adr-register.md (ADR-01 gate: Edge≠Ops credentials)
- /tmp/dth-phase-2-target-architecture/reviews/J-architecture-consistency.md (J-F-04 minimum list)
- /tmp/dth-phase-2-target-architecture/subagents/A-system-boundaries.md (§4 item 3: Edge intake ≠ Ops CC authz)
- docs/architecture/p3-f1-person-identity-authn.md
- docs/architecture/p3-f3-ops-bff-sot-alias-lock.md

### S2-C2 — Separate Ops deploy artifact

CONTROL_ID_OR_CANONICAL_NAME=separate Ops deploy artifact  
CONTROL_PURPOSE=Deploy Ops/CC (and ops-api) as a distinct artifact/plane from the public intake spine.  
CONTROL_BOUNDARY=Public `web`/`api` deploy path remains separate from `cc` / `ops-api` ops plane packaging.  
PHASE_3_IMPLEMENTATION_REFERENCE=P3-F0 package boundaries (`web`,`api`,`cc`,`ops-api`,`workers`,…)  
CURRENT_STATUS=DESIGN_AND_LOCAL_PACKAGE_BOUNDARY_REFLECTED  
SOURCE_EVIDENCE=
- /tmp/dth-phase-2-target-architecture/reviews/J-architecture-consistency.md (J-F-04 minimum list)
- /tmp/dth-phase-2-target-architecture/09-repo-deploy-architecture.md (R3 packages + separate deploy artifacts; package list includes `cc` and `ops-api`/`cc-bff`)
- docs/architecture/package-boundaries-p3-f0.md

### S2-C3 — No shared Averion operational planes

CONTROL_ID_OR_CANONICAL_NAME=no shared Averion planes  
CONTROL_PURPOSE=Prevent shared Command Center, database, auth, secrets, deploy, monitoring, audit, or customer-data planes with Averion.  
CONTROL_BOUNDARY=Averion remains time-bound technical assist only; not an ops control plane for DTH.  
PHASE_3_IMPLEMENTATION_REFERENCE=Phase-3 continuous TG-07 Averion-deny posture; package boundary checks reject Averion deps  
CURRENT_STATUS=DESIGN_AND_LOCAL_BOUNDARY_ENFORCED_IN_FOUNDATION_CHECKS  
SOURCE_EVIDENCE=
- /tmp/dth-phase-2-target-architecture/reviews/J-architecture-consistency.md (J-F-04 minimum list)
- /tmp/dth-phase-2-target-architecture/06-target-architecture-overview.md (AVERION_DTH_STRICT_SEPARATION; deny shared planes)
- /tmp/dth-phase-2-target-architecture/09-repo-deploy-architecture.md (Averion separate deploy credentials/projects)
- /tmp/dth-phase-2-target-architecture/subagents/A-system-boundaries.md (§4 item 6; Averion assist envelope)

### S2-C4 — Secret-admin is not CC identity

CONTROL_ID_OR_CANONICAL_NAME=secret-admin not CC identity  
CONTROL_PURPOSE=Forbid shared-secret / secret-admin bridge as steady-state human Command-Center session identity.  
CONTROL_BOUNDARY=CC sessions require PERSON_PRINCIPAL; shared-secret context is rejected for CC/ops person paths.  
PHASE_3_IMPLEMENTATION_REFERENCE=P3-F1 + P3-F3 AuthN gates (`SHARED_SECRET_CC_PATH_REJECTED`)  
CURRENT_STATUS=DESIGN_AND_LOCAL_FOUNDATION_REFLECTED  
SOURCE_EVIDENCE=
- /tmp/dth-phase-2-target-architecture/reviews/J-architecture-consistency.md (J-F-04 minimum list)
- /tmp/dth-phase-2-target-architecture/06-target-architecture-overview.md (rejects secret-admin bridge as steady-state CC)
- /tmp/dth-phase-2-target-architecture/08-adr-register.md (ADR-04 rejects shared secret admin as human AuthN)
- docs/architecture/p3-f1-person-identity-authn.md
- docs/architecture/p3-f3-ops-bff-sot-alias-lock.md

## Closure metrics

J_F04_SELECTED_S2_CONTROLS_DOCUMENTED=4  
J_F04_NEW_CONTROLS_INVENTED=0  
J_F04_STATUS=CLOSED_WITH_EVIDENCE  

## Explicit non-claims

- Does not authorize production IdP, strong AuthZ, production RLS, remote access, or deployment.
- Does not invent additional S2 controls beyond the Review-J minimum list used here.
