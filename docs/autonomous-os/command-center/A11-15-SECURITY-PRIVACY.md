# A11-15 Security / Privacy

- CSRF/origin: POST `/ops/v1/a11/commands` requires loopback Origin when Origin is present
- XSS: `esc()` on untrusted domain text; no `dangerouslySetInnerHTML`
- SQL: parameterized queries, allowlisted limits
- Secrets: no service_role, provider keys, or raw job payload in UI
- Cache: `private, no-store`; robots `noindex,nofollow` on CC routes
- Case lists: title/ref only
