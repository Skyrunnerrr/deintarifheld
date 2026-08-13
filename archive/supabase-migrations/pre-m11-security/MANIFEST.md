# MANIFEST — archived pre-M11 security local migrations

```text
STATUS=REFERENCE_ONLY
REMOTE_PRODUCTION_APPLIED=NO
REMOTE_STAGING_APPLIED=NO
```


## 003_foundation_reference.sql

```text
ORIGINAL_VERSION=003
ORIGINAL_FILENAME=003_foundation_reference.sql
ORIGINAL_PATH=supabase/migrations/003_foundation_reference.sql
ARCHIVE_PATH=archive/supabase-migrations/pre-m11-security/003_foundation_reference.sql
SHA256=19b95fd4ecb49e48ec6b77355c109b97cea1e85ad947f4d6047434a6ea756743
PURPOSE=Document actor/status conventions used by subsequent draft tables
REMOTE_PRODUCTION_APPLIED=NO
REMOTE_STAGING_APPLIED=NO
STATUS=REFERENCE_ONLY
FUTURE_RELEVANCE=may inform redesigned timestamp migrations after M11 security foundation; do not apply as-is

PERSISTENT_DDL_OBJECTS=NONE
SELECT_MARKER_ONLY=YES
```


## 004_cases.sql

```text
ORIGINAL_VERSION=004
ORIGINAL_FILENAME=004_cases.sql
ORIGINAL_PATH=supabase/migrations/004_cases.sql
ARCHIVE_PATH=archive/supabase-migrations/pre-m11-security/004_cases.sql
SHA256=b97b9129f01ed7f6652f78e4cad10f14fa00828973c456824023eaa793298b30
PURPOSE=First-slice cases table (Ops/CC work item root)
REMOTE_PRODUCTION_APPLIED=NO
REMOTE_STAGING_APPLIED=NO
STATUS=REFERENCE_ONLY
FUTURE_RELEVANCE=may inform redesigned timestamp migrations after M11 security foundation; do not apply as-is
```


## 005_case_notes.sql

```text
ORIGINAL_VERSION=005
ORIGINAL_FILENAME=005_case_notes.sql
ORIGINAL_PATH=supabase/migrations/005_case_notes.sql
ARCHIVE_PATH=archive/supabase-migrations/pre-m11-security/005_case_notes.sql
SHA256=1c6707f24f3ba3b45af877ac0eceb15d9d5077e9b604502ab8d917d3dd82f971
PURPOSE=Internal working notes on cases (SoT: CASE_NOTE_RECORDED — not alias tables)
REMOTE_PRODUCTION_APPLIED=NO
REMOTE_STAGING_APPLIED=NO
STATUS=REFERENCE_ONLY
FUTURE_RELEVANCE=may inform redesigned timestamp migrations after M11 security foundation; do not apply as-is
```


## 006_tasks_and_reminders.sql

```text
ORIGINAL_VERSION=006
ORIGINAL_FILENAME=006_tasks_and_reminders.sql
ORIGINAL_PATH=supabase/migrations/006_tasks_and_reminders.sql
ARCHIVE_PATH=archive/supabase-migrations/pre-m11-security/006_tasks_and_reminders.sql
SHA256=4a0a890a7a4cf1a3aabf9d8aa8c8b99984cebbf5bb862bd32e7315318520e9c3
PURPOSE=Tasks and Wiedervorlagen (reminders) for first-slice Ops/CC
REMOTE_PRODUCTION_APPLIED=NO
REMOTE_STAGING_APPLIED=NO
STATUS=REFERENCE_ONLY
FUTURE_RELEVANCE=may inform redesigned timestamp migrations after M11 security foundation; do not apply as-is
```


## 007_assignments.sql

```text
ORIGINAL_VERSION=007
ORIGINAL_FILENAME=007_assignments.sql
ORIGINAL_PATH=supabase/migrations/007_assignments.sql
ARCHIVE_PATH=archive/supabase-migrations/pre-m11-security/007_assignments.sql
SHA256=82df9446faaef5d28745dd9c76989fd74fb4579c796422fab70c8b75fc322c75
PURPOSE=Ownership / assignment history for cases (person principals only as assignees)
REMOTE_PRODUCTION_APPLIED=NO
REMOTE_STAGING_APPLIED=NO
STATUS=REFERENCE_ONLY
FUTURE_RELEVANCE=may inform redesigned timestamp migrations after M11 security foundation; do not apply as-is
```


## 008_status_history.sql

```text
ORIGINAL_VERSION=008
ORIGINAL_FILENAME=008_status_history.sql
ORIGINAL_PATH=supabase/migrations/008_status_history.sql
ARCHIVE_PATH=archive/supabase-migrations/pre-m11-security/008_status_history.sql
SHA256=8c9215499d5850986e9a22cf3ef0ac0c40b7a35f3cd909a4269465f29f9f9d2e
PURPOSE=Append-oriented status history for cases/tasks (foundation statuses only)
REMOTE_PRODUCTION_APPLIED=NO
REMOTE_STAGING_APPLIED=NO
STATUS=REFERENCE_ONLY
FUTURE_RELEVANCE=may inform redesigned timestamp migrations after M11 security foundation; do not apply as-is
```


## 009_communication_events.sql

```text
ORIGINAL_VERSION=009
ORIGINAL_FILENAME=009_communication_events.sql
ORIGINAL_PATH=supabase/migrations/009_communication_events.sql
ARCHIVE_PATH=archive/supabase-migrations/pre-m11-security/009_communication_events.sql
SHA256=4d67f9c4b61e96119e4f5ff863bfb4d858904ae48ae2e2dace970c676d1ef205
PURPOSE=Communication events SoT store (store SoT IDs only; aliases never create types)
REMOTE_PRODUCTION_APPLIED=NO
REMOTE_STAGING_APPLIED=NO
STATUS=REFERENCE_ONLY
FUTURE_RELEVANCE=may inform redesigned timestamp migrations after M11 security foundation; do not apply as-is
```


## 010_ops_audit_events.sql

```text
ORIGINAL_VERSION=010
ORIGINAL_FILENAME=010_ops_audit_events.sql
ORIGINAL_PATH=supabase/migrations/010_ops_audit_events.sql
ARCHIVE_PATH=archive/supabase-migrations/pre-m11-security/010_ops_audit_events.sql
SHA256=b9da9f6ab3fb1a82dfc8279e27d6a047613fc8c45726cfdae81661f020ff4d6c
PURPOSE=Ops/CC audit foundation compatible with P3-F1 actor fields
REMOTE_PRODUCTION_APPLIED=NO
REMOTE_STAGING_APPLIED=NO
STATUS=REFERENCE_ONLY
FUTURE_RELEVANCE=may inform redesigned timestamp migrations after M11 security foundation; do not apply as-is
```


## 011_approvals.sql

```text
ORIGINAL_VERSION=011
ORIGINAL_FILENAME=011_approvals.sql
ORIGINAL_PATH=supabase/migrations/011_approvals.sql
ARCHIVE_PATH=archive/supabase-migrations/pre-m11-security/011_approvals.sql
SHA256=8f59509afb947adb26a11c80cd9e47e0cff8056e78db7a9eb34e57d6505728e4
PURPOSE=Approval request/decision foundation (no automatic four-eyes activation)
REMOTE_PRODUCTION_APPLIED=NO
REMOTE_STAGING_APPLIED=NO
STATUS=REFERENCE_ONLY
FUTURE_RELEVANCE=may inform redesigned timestamp migrations after M11 security foundation; do not apply as-is
```


## 012_transactional_outbox.sql

```text
ORIGINAL_VERSION=012
ORIGINAL_FILENAME=012_transactional_outbox.sql
ORIGINAL_PATH=supabase/migrations/012_transactional_outbox.sql
ARCHIVE_PATH=archive/supabase-migrations/pre-m11-security/012_transactional_outbox.sql
SHA256=0594cd43e925176a73d79bd78531420cebaa320565e03dcd64acf12c65a3e690
PURPOSE=Transactional outbox foundation (no worker, no dispatch, no external integration)
REMOTE_PRODUCTION_APPLIED=NO
REMOTE_STAGING_APPLIED=NO
STATUS=REFERENCE_ONLY
FUTURE_RELEVANCE=may inform redesigned timestamp migrations after M11 security foundation; do not apply as-is
```


## 013_indexes_and_validation.sql

```text
ORIGINAL_VERSION=013
ORIGINAL_FILENAME=013_indexes_and_validation.sql
ORIGINAL_PATH=supabase/migrations/013_indexes_and_validation.sql
ARCHIVE_PATH=archive/supabase-migrations/pre-m11-security/013_indexes_and_validation.sql
SHA256=e38bf2a247fb9f3daf83b44ce414909e20cf5e3edfb4b4d5d68e4b88944f4e7b
PURPOSE=Additive cross-cutting indexes / validation notes already largely inline;
REMOTE_PRODUCTION_APPLIED=NO
REMOTE_STAGING_APPLIED=NO
STATUS=REFERENCE_ONLY
FUTURE_RELEVANCE=may inform redesigned timestamp migrations after M11 security foundation; do not apply as-is
```
