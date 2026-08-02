# Package Boundaries — P3-F0 (J-F-03 visible)

TRANCHE=P3-F0
REPOSITORY_STRATEGY=R3_DEINTARIFHELD_MONOREPO_WITH_STRICT_APP_PACKAGE_AND_DEPLOYMENT_BOUNDARIES
IMPLEMENTATION_AUTHORIZED=P3_F0_ONLY

## Canonical package list (ADR-02 + Doc 09 + ops-api + workers)

| Directory | NPM name | Responsibility | Productive logic in P3-F0 |
|---|---|---|---|
| `packages/web` | `@deintarifheld/web` | Public website boundary | NO (live app remains repo root) |
| `packages/api` | `@deintarifheld/api` | Public intake API boundary | NO (live routes remain `app/api`) |
| `packages/cc` | `@deintarifheld/cc` | DTH Command Center UI boundary | NO |
| `packages/ops-api` | `@deintarifheld/ops-api` | CC BFF boundary | NO |
| `packages/shared` | `@deintarifheld/shared` | DTH-owned shared types/constants | NO |
| `packages/db` | `@deintarifheld/db` | DB/migrations boundary | NO (migrations unauthorized) |
| `packages/workers` | `@deintarifheld/workers` | Workers/automation boundary | NO (activation unauthorized) |

## Canonical shared package name

CANONICAL_SHARED_PACKAGE_NAME=`shared`
ALTERNATIVE_ALIAS_CREATED=NO (`dth-shared` not created; J-F-07 optional only)

## Separation

AVERION_DTH_STRICT_SEPARATION=YES
SHARED_COMMAND_CENTER=NO
SHARED_DATABASE=NO
SHARED_AUTH=NO
SHARED_SECRETS=NO

## Public spine

Existing Next.js app at repository root and `app/api/*` remain the live public spine in P3-F0.
Package folders are boundaries only; no route/behavior move in this tranche.

## J-F-03

STATUS=CLOSED_WITH_EVIDENCE via this artifact + `packages/*` skeleton including `ops-api` and `workers`.

P3-F7 reaffirmation (no reopen): see [phase-3-j-findings-register.md](./phase-3-j-findings-register.md).  
J_F03_REOPENED=NO · J_F03_RUNTIME_ACTION=NONE · IMPLEMENTATION_COMMIT=501c1a6
