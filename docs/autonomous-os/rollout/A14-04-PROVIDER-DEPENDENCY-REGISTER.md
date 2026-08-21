# A14-04 Provider Dependency Register

Names/status only. **No credentials. No silent provider choice.**

| Domain | Purpose | E2 adapter | Live candidate (docs) | Sandbox | Status |
|--------|---------|------------|----------------------|---------|--------|
| A4 mail | Outbound/inbound | Synthetic/test | Resend (candidate) | Unknown until Owner | NOT_PROVEN |
| A5 calendar | Availability/book | test_calendar | Google / Graph / TBD | TBD | NOT_PROVEN |
| A6 storage | Documents | LocalTestDocumentStorage | TBD object store | TBD | NOT_PROVEN |
| A6 OCR | Extraction | Local PDF stream | TBD | TBD | NOT_PROVEN |
| A6 malware | Scan | None | TBD | TBD | NOT_PROVEN |
| A7 tariffs | Catalogue/pricing | Synthetic catalogue | TBD live source | TBD | NOT_PROVEN |
| A9 switching | Supplier submit | TEST_SWITCH_V1 | TBD | TBD | NOT_PROVEN |
| A10 lifecycle | Contract/renewal facts | Test lifecycle | TBD / may share A9 | TBD | NOT_PROVEN |
| A12 AI | Content generation | DeterministicTestContentGenerator | TBD or NOT_DEPLOYED | TBD | NOT_PROVEN |
| A12 publishing | Social/blog | DeterministicTestPublishingProvider | TBD | TBD | NOT_PROVEN |
| A13 acquisition | Ads/campaigns | DeterministicTestAcquisitionProvider | TBD paid media | Prefer zero-spend first | NOT_PROVEN |

Rule: implement existing A4–A13 ports; do **not** invent a mega-provider framework.
