# A7-04 Tariff Versioning & Provenance

Versions are immutable identity (`product_id`,`version`) with `source_kind=TEST_FIXTURE`, `source_ref`, `source_hash`.

Valid_from/valid_to enforced. Expired/future/inactive excluded from active catalogue snapshots. No in-place overwrite of commercial history for evaluations (historical rows reference version id).

