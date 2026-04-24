# Quick onboarding

## Recommended path: talk to OpenClaw

The intended user experience is prompt-first.

A good starting prompt is:

```text
Set up the VCL feedback loop for my project. Use Telegram notifications.
```

The agent should then ask only for the missing inputs, usually:

- the VCL Agent API curl snippet from the project page
- the Telegram destination chat/user id
- whether the user wants `OK / HOLD / ASK` handling
- whether the user wants reply + changelog posting enabled

## What the user needs to do in VCL first

1. Add the project to VCL.
2. Open the project's **Agent API** tab.
3. Create a scoped API key with the permissions you need:
   - read feedback
   - reply to feedback
   - post changelog updates
4. Copy the curl example from that page.

## What the agent should do next

1. Bootstrap local config from the curl snippet.
2. Add Telegram notify settings.
3. Verify polling works.
4. Test notification delivery.
5. Install the 5-minute cron.
6. Explain `OK`, `HOLD`, and `ASK`.

## Manual equivalents

```bash
node scripts/bootstrap-vcl-feedback-loop.js --curl-file ~/vcl-curl.txt --channel telegram --target CHAT_ID --account default
node scripts/poll-vcl-feedback.js
node scripts/poll-vcl-feedback.js --notify-openclaw
node scripts/handle-vcl-response.js "ASK 24 Could you clarify whether this issue is mobile-only?"
node scripts/vcl-api.js changelog --content "- Improved contrast" --linked-feedback-ids "24"
```
