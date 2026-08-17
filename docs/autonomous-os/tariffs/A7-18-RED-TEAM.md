# A7-18 Red Team

| ID | Challenge | Result |
|----|-----------|--------|
| RT-A7-01 | unsafe float money | PASS — micro BigInt; float EUR rejected |
| RT-A7-02 | net vs gross | PASS — not comparable |
| RT-A7-03 | bonus recurring | PASS — first_year only |
| RT-A7-04/05/06 | expired/future/inactive | PASS — excluded |
| RT-A7-06 | private→B2B | PASS — INELIGIBLE |
| RT-A7-07 | elec↔gas | PASS |
| RT-A7-09 | conflict ignored | PASS — blocked |
| RT-A7-10/11 | invent baseline/savings | PASS |
| RT-A7-12 | multi-site base | PASS — 2× |
| RT-A7-15/16/17 | dup/stale | PASS |
| RT-A7-18 | executable rules | PASS — known rule_types only |
| RT-A7-19/20 | injection/commission | PASS — no effect |
| RT-A7-22/23 | fixture≠live | PASS — TEST_FIXTURE + LIVE=0 |
| RT-A7-24/25 | currency/rounding | PASS |

Material FAIL: none observed in E2 local suite.

