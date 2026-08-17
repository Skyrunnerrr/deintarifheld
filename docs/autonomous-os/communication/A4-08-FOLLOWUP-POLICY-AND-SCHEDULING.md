# A4-08 Follow-up Policy and Scheduling

## CommunicationPolicyV1

- Test delay: 50ms (`A4_TEST_FOLLOWUP_DELAY_MS`)
- Max follow-ups: 1
- Production cadence: OWNER_FOLLOWUP_CADENCE_REQUIRED=YES
- Live autonomous follow-up: BLOCKED until Owner cadence is frozen

Scheduled only after PROVIDER_ACCEPTED, as A1 job `B2B_MISSING_INFO_FOLLOWUP_DUE` with `scheduled_at`. No setTimeout.

Pre-send revalidation: still missing, same revision/requirements, no correlated inbound, no kill/takeover/suppression, generation ≤ max.

Cancel when: customer reply correlated, Case QUALIFIED_FOR_CALL, bounce, stale revision, max reached.

Count is durable on `ops.conversations.followup_count` and `ops.followup_schedules.generation`. Restart cannot reset it.
