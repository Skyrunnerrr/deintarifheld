# A11-12 AuthN / AuthZ

E2 test identities (non-production): TEST_OWNER / TEST_OPERATOR / TEST_APPROVER / TEST_VIEWER.

Server maps `session.personId` → role/capabilities. Body `role=OWNER` is ignored (`FORGED_ROLE_IGNORED`). Missing session → 401.

Viewer: read. Operator: tasks/notes/takeover/reprocess/reconcile. Approver: approval decide. Owner: kill/control + all.

`OWNER_COMMAND_CENTER_AUTH_PROVIDER_REQUIRED=YES`. `STRONG_AUTHZ_COMPLETE=NO`.
