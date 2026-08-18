# A11-11 Tasks / Notes

Reuse P3 tables `public.tasks` and `public.case_notes` when present. Task status and notes are operator context. They do not change qualification, tariff, offer, switch, or lifecycle authority. Missing schema returns a bounded error, not a invented SoT.
