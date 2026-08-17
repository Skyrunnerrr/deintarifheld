# A4-07 Reply Interpretation

Layer 1: deterministic labelled extraction (`Stromverbrauch: 50000`, `Standorte: 2–5`) and single-field bare number / standorte tokens.

Layer 2: AMBIGUOUS / HUMAN_REVIEW when no high-confidence extract.

Quoted history stripped on `>`, `Am … schrieb`, `On … wrote:`.

Automated replies (Auto-Submitted, mailer-daemon, OOO) are not observations.

A4 extracts candidates only. A3 `applyQualificationObservation` + `evaluateQualification` remain normalization/truth authority. No second number parser.

AI adapter `interpretMissingInfoReplyAi()` throws `AI_REPLY_INTERPRETATION_NOT_IMPLEMENTED`. LIVE_AI_CALLS=0.

Prompt-injection text is ordinary untrusted data. It cannot change tools, policy, recipient, or qualification except via allowlisted extracted fields.
