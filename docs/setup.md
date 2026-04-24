# Setup notes

## Default paths

Config:
`~/.openclaw/workspace/.openclaw/vcl-feedback-loop.json`

State:
`~/.openclaw/workspace/.state/vcl-feedback-loop-state.json`

## Safe cron example

```cron
*/5 * * * * cd /ABSOLUTE/PATH/TO/openclaw-vcl-feedback-loop && /usr/bin/node scripts/poll-vcl-feedback.js --notify-openclaw >> ~/.openclaw/workspace/.state/vcl-feedback-loop-cron.log 2>&1
```

## Approval model

- `OK <id>` → approved for implementation
- `HOLD <id>` → stop reminders but do not implement

Only after explicit approval should downstream automation run.
