# A7-10 Ranking Policy

`TariffRankingPolicyV1`: lowest `ongoing_annual_micro`, tie-break `tariff_version_id` ASC. Commission never influences ranking (`commissionInRanking=false`). OWNER_TARIFF_RANKING_POLICY_REQUIRED remains true for production policy choice.

