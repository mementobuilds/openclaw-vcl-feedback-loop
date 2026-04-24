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
  - `project_intelligence:read`
  - `project_intelligence:write_feedback`
  - `project_intelligence:write_updates`
- the project id / project page URL you need for config
- a **Read insights** curl template you can use as a fallback bootstrap input

If you need the numeric `projectId`, you can read it from the `/projects/<id>/...` part of the Read insights URL.

## Telegram setup for the default flow

The scripts do **not** talk to Telegram directly.
They send through **OpenClaw** using `openclaw message send`.

So for a Telegram-based setup, make sure:

1. Telegram is already connected to OpenClaw
2. the connected bot/account has already spoken in the destination chat at least once
3. you know the target chat or user id if the agent cannot infer it
4. the loop config includes:

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
Set this up, send VCL notifications to my Telegram chat, connect the target project repo, and prepare the deploy flow so approved fixes can be shipped automatically.
```

## Target project repo + deploy access

For end-to-end automation, the VCL loop is only half the setup.
The agent also needs:

- access to the target project's source repo
- permission to clone or edit it locally
- a deploy path it can trigger from CLI after making fixes

That deploy path can be Railway, Vercel, Netlify, GitHub Actions, a VPS, or a local deploy script. The important part is not the platform; it is that the agent can ship approved fixes programmatically after `OK`.

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
