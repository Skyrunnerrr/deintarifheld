# A14-09 Data Flow Register

Planned/current synthetic flows. **No “GDPR compliant” claim.** Live provider rows remain UNKNOWN until selected.

| Flow | Data categories | Direction | Purpose | Storage today | Live provider sharing | Deletion | Status |
|------|-----------------|-----------|---------|---------------|----------------------|----------|--------|
| Public B2B intake | Email, firma, form fields | In | Lead accept | public.leads (local E2) | None in E2 | Lead retention TBD | E2 |
| A4 mail | Recipient, template IDs | Out/In | Comms | ops conversations | Resend TBD | TBD | NOT_PROVEN |
| A5 calendar | Times, attendee email | Out/In | Booking | ops booking | Calendar TBD | TBD | NOT_PROVEN |
| A6 documents | PDFs, extracted facts | In | Evidence | Local test storage | Storage/OCR TBD | TBD | NOT_PROVEN |
| A7 tariffs | Prices, products | In | Evaluation | Synthetic catalogue | Source TBD | N/A catalogue | NOT_PROVEN |
| A8 offers | Commercial options | Out | Customer offer | ops offers | Via A4 | TBD | NOT_PROVEN |
| A9 switch | Supply/tariff payload | Out/In | Switch | ops switch | Provider TBD | TBD | NOT_PROVEN |
| A12 content | Copy, claims | Out | Publish | ops content | AI/publisher TBD | TBD | NOT_PROVEN |
| A13 acquisition | Opaque acq_ref, metrics | In/Out | Attribution | ops acquisition | Ads TBD | Tracking retention TBD | NOT_PROVEN |
| A11 operators | Identity, capabilities | In | Control | sessions (test) | IdP TBD | Offboarding TBD | NOT_PROVEN |

Fingerprinting: **not introduced** in A13 E2. Production tracking requires OD-A13-TRACKING.
