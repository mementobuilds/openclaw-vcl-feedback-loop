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

## Telegram setup for the Tap Flash-style flow

The scripts do **not** talk to Telegram directly.
They send through **OpenClaw** using `openclaw message send`.

So for a Telegram-based setup, make sure:

1. Telegram is already connected to OpenClaw
2. you know the target chat or user id
3. the loop config includes:

```json
{
  "notify": {
    "channel": "telegram",
    "target": "CHAT_ID",
    "account": "default"
  }
}
```

Prompt-first version:

```text
Set this up like Tap Flash and send VCL notifications to my Telegram chat.
```

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
