# Quick onboarding

If you do not have OpenClaw yet, start here:
- GitHub: <https://github.com/openclaw/openclaw>
- Docs: <https://docs.openclaw.ai>

## Recommended path: talk to OpenClaw

The intended user experience is prompt-first.

A good starting prompt is:

```text
Set up the VCL feedback loop for my project. Use Telegram notifications.
```

The agent should then ask only for the missing inputs, usually:

- the VCL project page URL or project id
- the VCL API key
- the Telegram destination chat/user id

## What the user needs to do in VCL first

1. Add the project to VCL.
2. Open the project's **Agent API** tab.
3. Create one API key with the permissions you need:
   - `project_intelligence:read`
   - `project_intelligence:write_feedback`
   - `project_intelligence:write_updates`
4. Copy the project page URL or note the project id.
5. Give the agent the API key.

Fallback: if needed, the user can also copy the **Read insights** curl template from that page.

## What the agent should do next

1. Create local config from the project id/url + API key.
2. Add Telegram notify settings.
3. Verify polling works.
4. Test notification delivery.
5. Install the 5-minute cron.
6. Explain `OK`, `HOLD`, and `ASK`.

## Manual equivalents

```bash
node scripts/poll-vcl-feedback.js
node scripts/poll-vcl-feedback.js --notify-openclaw
node scripts/handle-vcl-response.js "ASK 24 Could you clarify whether this issue is mobile-only?"
node scripts/vcl-api.js changelog --content "- Improved contrast" --linked-feedback-ids "24"
```
