# A12-16 Security and Privacy

- No customer PII required for generic content. E2 case examples: none.
- A12 does not browse Cases for stories.
- No psychographic / sensitive targeting.
- Credentials never in browser, job payload, audit, or LLM prompt (E2: no live credentials).
- Prompt injection in source/candidate cannot change policy, approval, channel, schedule, or credentials.
- XSS escaped at channel render; script-bearing candidates BLOCKED.
- Unapproved external hosts BLOCKED.
- Logs: ids, revision, channel, state, risk, claim counts, provider codes. No prompts-with-secrets, no provider secrets.
- No chain-of-thought persistence.
- Kill: AUTOMATION_ENGINE + global kill. No ninth KillDomain.
