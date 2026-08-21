# A14-08 Autonomy Level Matrix

Levels: L0 OBSERVE · L1 DRAFT · L2 AUTO_INTERNAL · L3 AUTO_EXTERNAL_LOW_RISK · L4 AUTO_EXTERNAL_BOUNDED · L5 FULL_POLICY_AUTONOMY

| Domain | Current E2 | Max approved for Production (until Owner) | Kill domain | Notes |
|--------|------------|---------------------------------------------|-------------|-------|
| A3 | L2 synthetic | L0/L1 | AUTOMATION_ENGINE | Low commercial risk |
| A4 | L2 synthetic mail | L0 | INTERNAL_MAIL / AUTOMATION_ENGINE | Customer-facing |
| A5 | L2 test calendar | L0 | AUTOMATION_ENGINE | Double-book risk |
| A6 | L2 local storage | L0 | DATA_IMPORT / AUTOMATION_ENGINE | PII |
| A7 | L2 synthetic tariffs | L0/L1 | AUTOMATION_ENGINE | Feed to A8 |
| A8 | L2 synthetic offers | **L0** | AUTOMATION_ENGINE | High legal risk |
| A9 | L2 TEST_SWITCH | **L0** | AUTOMATION_ENGINE | High impact |
| A10 | L2 test lifecycle | L0/L1 | AUTOMATION_ENGINE | Renewal risk |
| A11 | L1/L2 test persons | **L0** without AuthN | COMMAND_CENTER_WRITE_ACTIONS | Control plane |
| A12 | L2 deterministic | L0/L1; autopublish off | AUTOMATION_ENGINE | Claims |
| A13 | L2 test ads | **L0** | AUTOMATION_ENGINE | Spend risk |

Promotion is **per-domain**, never global. No “Enable Full Autonomy” command.
