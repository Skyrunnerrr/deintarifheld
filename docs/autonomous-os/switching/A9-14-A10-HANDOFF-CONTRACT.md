# A9-14 A10 handoff contract

After SWITCH_CONFIRMED: `ops.lifecycle_handoffs` + job `CUSTOMER_LIFECYCLE_PREPARE`. Fields: case_id, offer_revision_id, switch_attempt_id, provider_order_id, tariff version, confirmed_start, energy_type, supply_point_count. Unique attempt. `renewal_scheduled=false`. Handler acks only.
