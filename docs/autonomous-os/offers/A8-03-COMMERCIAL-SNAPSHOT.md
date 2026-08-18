# A8-03 Commercial snapshot

JSON `A8CommercialSnapshotV1` stores A7 evaluation id, fingerprints, catalogue snapshot, policy versions, and per-option micro amounts as **strings**. Hash = canonical SHA-256. Display uses BigInt split by `MICRO_EUR_SCALE` (`formatMicroEurDe`). No `Number(bigint)/1e6`. Unknown savings omitted; negative savings shown as additional cost; first-year ≠ ongoing displayed separately; NET/GROSS copied from A7.
