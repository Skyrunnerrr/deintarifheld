# A0 Loop Catalog

| Loop | Trigger | A1 req? | Revenue path? | Later? |
|------|---------|---------|---------------|--------|
| LOOP-01 Intake Processing | lead accepted | YES | YES | |
| LOOP-02 Qualification | case QUALIFYING | needs A3 | YES | |
| LOOP-03 Missing Information | gaps detected | A3/A4 | YES | |
| LOOP-04 Customer Reply | inbound message | A4 | YES | |
| LOOP-05 Appointment Booking | QUALIFIED+ | A5 | YES | |
| LOOP-06 Appointment Reminder | booking | A5 | YES | |
| LOOP-07 Document Completion | upload | | | A6 |
| LOOP-08 Tariff Evaluation | OFFER_INPUT_READY | | | A7 |
| LOOP-09 Offer | tariff ready | | | A8 |
| LOOP-10 Offer Follow-up | OFFER_SENT | | | A8 |
| LOOP-11 Switching | ACCEPTED | | | A9 |
| LOOP-12 Supplier Status | switch submitted | | | A9 |
| LOOP-13 Customer Notification | status changes | A4 | YES | |
| LOOP-14 Renewal | renewal due | | | A10 |
| LOOP-15 Failure/Retry | job fail | **A1** | YES | |
| LOOP-16 DLQ Recovery | dead letter | **A1** | YES | |
| LOOP-17 Human Escalation | low confidence/policy | A1+ | YES | |
| LOOP-18 Content | schedule | | | A12 |
| LOOP-19 Acquisition | campaigns | | | A13 |

Each loop requires: eligibility, capability, durable intent, success/failure signal, retry class, cancel condition, kill domain, audit, metric (detailed in A1 design).
