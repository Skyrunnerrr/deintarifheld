# A12-09 Content Revisioning

Revisions are immutable. Material edit → new revision (`createSupersedingRevision`). Fingerprint unique on brief + generator + policies + content hash + claims.

One current revision per item (`content_revisions_one_current`). Old approval cannot publish N+1 (`STALE_CONTENT_APPROVAL` / `STALE_CONTENT_REVISION`). Duplicate fingerprint returns existing revision, no second logical item.
