# A12-12 Publishing Provider

Port: `publishPost`, `getPost`, `getMetrics`. `deletePost` unsupported in E2. No generic `request(url)`.

E2: `DeterministicTestPublishingProvider`. Modes: PUBLISH_ACCEPTED, REJECTED, TRANSIENT_KNOWN_NOT_EXECUTED, TIMEOUT_UNKNOWN, READBACK_FOUND / NOT_FOUND / MISMATCH.

`OWNER_CONTENT_PUBLISHING_PROVIDER_REQUIRED=YES`. No Meta/LinkedIn/Metricool freeze. Server owns account/channel/provider. Client cannot select them.

`LIVE_SOCIAL_PROVIDER_CALLS=0`. `LIVE_CONTENT_PUBLICATIONS=0`. Provider accepted ≠ published until readback.
