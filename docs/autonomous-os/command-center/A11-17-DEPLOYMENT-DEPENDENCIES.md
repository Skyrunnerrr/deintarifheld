# A11-17 Deployment Dependencies

Current CC is loopback Node (`packages/cc` + `packages/ops-api` HTTP adapter). Fail-closed in `NODE_ENV=production`. Static hosting cannot protect operator writes. `OWNER_COMMAND_CENTER_DEPLOYMENT_DECISION_REQUIRED=YES`. No new hosting provider introduced. No credentials in the browser.
