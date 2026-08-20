# A12-04 Content Generation Port

Bounded: `generateContentCandidate(brief)` → headline, body, CTA, hashtags, links, structured claim hints.

E2: `DeterministicTestContentGenerator` (fixtures by `ContentGeneratorMode`). `LIVE_AI_CALLS_A12=0`.

No tools, no posting, no DB mutation by the generator. Candidate never becomes APPROVED/SCHEDULED/PUBLISHED by generation alone.

`OWNER_CONTENT_AI_PROVIDER_REQUIRED=YES`. Does not block E2.
