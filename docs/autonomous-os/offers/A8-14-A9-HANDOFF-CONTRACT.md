# A8-14 A9 handoff contract

On first ACCEPT: insert `ops.switch_preparations` + enqueue `SWITCH_PREPARATION`. Payload: case_id, offer_id, offer_revision_id, commercial_snapshot_hash, selected_tariff_version_id, catalogue_snapshot_id. Handler acks only. `supplier_switch_initiated` CHECK false. No re-ranking. Unavailability after accept is an A9 exception, not silent substitute.
