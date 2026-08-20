# A12-05 Claim Governance

Claims are extracted and persisted per revision.

Types: SAVINGS, TARIFF_AS_LIVE, TESTIMONIAL, SUPERLATIVE, LEGAL, PROCESS, EDUCATION, PRODUCT, LINK, OTHER.

States: SUPPORTED, UNSUPPORTED, UNKNOWN, PROHIBITED, REVIEW_REQUIRED.

Only supported/allowed claims may auto-publish. Prohibited/unsupported → BLOCKED; schedule denied.

Hard blocks (E2): percent/euro savings, synthetic tariff as live, testimonials, market superlatives, legal-advice language, prompt-injection strings, unapproved hosts.

A7 synthetic tariff data cannot appear as a live public offer. `SYNTHETIC_TARIFF_PUBLIC_CONTENT_CLAIMS=0`.
