# A6-04 Hash + Dedup

SHA-256 of bytes. Same case + hash → duplicate receipt pointing at existing row.  
Same hash across cases → isolated rows; `getCaseEnergyEvidence` does not leak cross-case.
