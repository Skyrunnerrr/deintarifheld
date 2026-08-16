# A0 Critical Paths

## CRITICAL_PATH_TO_FIRST_AUTONOMOUS_B2B_LOOP (priority)

```text
A1 Durable Workflow Runtime
→ A2 Lead→Case Autopilot (M11T)
→ A3 Qualification + Missing Info
→ A4 Communication Engine
→ A5 Calendar
→ DTH-AUTONOMY-E2E-01 (local/test adapters)
```

## CRITICAL_PATH_TO_STAGING_AUTONOMY

```text
(above local path)
+ M11F→P (AuthZ/RLS/session/kill)
→ staging AUTONOMY-E2E-01
```

## CRITICAL_PATH_TO_PRODUCTION_AUTONOMY

```text
staging E2E-01 PASS
→ A6–A10 as needed for full revenue loop
→ M11Q→R→T→S cutover
→ A11 production CC
→ A14 rollout levels
```

## CRITICAL_PATH_TO_CONTENT_AUTONOMY

```text
A12 after A11 controls exist
```

## CRITICAL_PATH_TO_ACQUISITION_AUTONOMY

```text
A13 after inbound revenue loop stable; separate domain
```
