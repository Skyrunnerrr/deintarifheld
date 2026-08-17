# A6-08 Normalization + Provenance

Reuse A3 `parseConsumptionKwh` for digit-only. Document parser `parseDocumentConsumptionKwh` accepts German `50.000 kWh` / `50 000 kWh` when unit explicit.  
Every fact stores evidence_span, extractor_version, method. Page null when unproven.
