# Setup notes

## Default paths

Config:
`~/.openclaw/workspace/.openclaw/vcl-feedback-loop.json`

State:
`~/.openclaw/workspace/.state/vcl-feedback-loop-state.json`

## Agent API access

After a project is live on VCL, open the project page and go to the **Agent API** tab.

That page gives you:

- an API key you can scope for:
  - read feedback
  - reply to feedback
  - post changelog updates
- an example curl command you can feed into the bootstrap script

## Safe cron example

```cron
*/5 * * * * cd /ABSOLUTE/PATH/TO/openclaw-vcl-feedback-loop && /usr/bin/node scripts/poll-vcl-feedback.js --notify-openclaw >> ~/.openclaw/workspace/.state/vcl-feedback-loop-cron.log 2>&1
```

## Approval / reply model

- `OK <id>` → approved for implementation
- `HOLD <id>` → stop reminders but do not implement
- `ASK <id> <question>` → post a clarification question back into the VCL thread

Only after explicit approval should downstream implementation/deploy automation run.

## Changelog linkage

When posting a changelog entry, use `--linked-feedback-ids` so VCL can show which feedback influenced the shipped update.

Example:

```bash
node scripts/vcl-api.js changelog \
  --content "- Improved button contrast\n- Clarified restart state" \
  --linked-feedback-ids "24,26"
```
