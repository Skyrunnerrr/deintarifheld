# A3-08 A4 Communication Contract

APIs:

- `getCurrentQualification(caseId)`
- `getOpenMissingRequirements(caseId)`
- `getQualificationRevision(caseId)`
- `isQualificationRevisionCurrent(caseId, revision)`
- `applyQualificationObservation({...})`

Before send: re-read; if revision stale → DO NOT SEND.

A4 E2 binds these APIs on durable outbound intents. A4 does not write qualification outcomes.
