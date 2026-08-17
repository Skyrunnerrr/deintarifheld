# A7-02 Case Energy Profile

`ops.energy_profiles` is the canonical per-case energy input snapshot.

Built from A6 accepted facts + lead payload (consumption/postcode/sites/baseline). Conflicts/ambiguous facts → `CONFLICT_REVIEW_REQUIRED` / `HUMAN_REVIEW` — no pricing.

Fingerprint + revision; only one `is_current` per case.

