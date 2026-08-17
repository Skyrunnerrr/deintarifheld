# A4-11 Security / Prompt Injection

Customer email body = UNTRUSTED_DATA.

Forbidden effects from inbound text:

- tool calls, SQL, URL fetch
- workflow / kill / control / policy change
- recipient redirect
- generic `sendEmail(to, subject, body)` agent tool

Future agent tools (not exposed in E2):

- `prepareMissingInfoCommunication(caseId)`
- `submitInboundObservation(messageId, candidateObservation)`

No provider secret in jobs, audit, client, or prompts.

Webhook forgeries create zero business effects.

Client cannot choose recipient, purpose, template, or qualification revision.
