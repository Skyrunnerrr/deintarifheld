# A10-04 Contract date policy

ContractDatePolicyV1: civil DATE, CLAMP_TO_LAST_DAY month arithmetic. Leap year Feb 29 → Feb 28 next year. Notice deadline = expected_end − days. No JS local Date overflow.
