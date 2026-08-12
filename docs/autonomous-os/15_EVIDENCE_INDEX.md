# Evidence Index

## Persistent evidence root (canonical for M0–M5)

```text
/Users/noahbez/Library/Application Support/DeinTarifHeld/AutonomousOS/evidence/DTH-M0-M5/
```

| File | Content |
|---|---|
| `00-freeze.txt` | Freeze identity |
| `01-inventory.txt` | Repository inventory |
| `02-secret-scan.txt` | Secret scan + disposition |
| `03-local-backup.txt` | Bundle + patch archive hashes |
| `04-remote-safety-branch.txt` | Safety branch push |
| `05-remote-verify.txt` | Remote tip verification |

## Local backups

```text
/Users/noahbez/Library/Application Support/DeinTarifHeld/AutonomousOS/backups/
  dth-safety-955e849-head14.bundle
  dth-14-patches-955e849.tgz
```

## Remote safety

```text
origin/safety/dth-p3-p4-freeze-955e849
TIP=955e849d3f9006910a989727d9f21608a2f682e6
```

## Rules

- `/tmp` is **not** canonical audit evidence.
- Never store tokens, emails, OTP, cookies, or secret values in evidence.
- Agent “PASS” statements are not evidence.
