# A7-05 Eligibility Engine

Pure `evaluateTariffEligibility` with bounded `EligibilityRuleType` registry. DB stores params jsonb only — never executable code.

Statuses: ELIGIBLE | INELIGIBLE | UNRESOLVED. Missing required facts → UNRESOLVED (not INELIGIBLE). Private ≠ B2B. Electricity ≠ gas.

