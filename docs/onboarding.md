# Quick onboarding

If you do not have OpenClaw yet, start here:
- GitHub: <https://github.com/openclaw/openclaw>
- Docs: <https://docs.openclaw.ai>

## Recommended path: talk to OpenClaw

The intended user experience is prompt-first.

A good starting prompt is:

```text
Clone https://github.com/mementobuilds/openclaw-vcl-feedback-loop
and set up the full VCL workflow for my project.

Use Telegram notifications.
Connect the target project repo.
Set up the implementation/deploy side so approved fixes
can be shipped and posted back to VCL.

If anything is missing, figure out what you can automatically
and ask me only for the remaining required inputs.
```

The agent should then ask only for the missing inputs, usually:

- the VCL project page URL or project id
- the VCL API key
- the Telegram destination chat/user id, if it cannot infer it
- the target project repo URL
- the preferred deploy target or deploy script details, if they are not already discoverable

## What the user needs to do in VCL first

1. If the project is not on VCL yet, submit it here:
   <https://vibecodinglist.com/submit>
2. Open the project's **Agent API** tab.
3. Create one API key with the permissions you need:
   - `project_intelligence:read`
   - `project_intelligence:write_feedback`
   - `project_intelligence:write_updates`
4. Copy the project page URL or note the project id.
5. Give the agent the API key.
6. If you want Telegram alerts, connect Telegram to OpenClaw. If the agent cannot infer the destination later, provide the numeric chat id.
7. If you want full implementation + deploy flow, give the agent access to the target project repo and make sure there is a deploy path it can trigger from CLI.

Fallback: if needed, the user can also copy the **Read insights** curl template from that page.

## What the agent should do next

1. Create local config from the project id or project URL plus the API key.
2. Add Telegram notify settings.
3. Verify polling works.
4. Test notification delivery.
5. Install the 5-minute cron.
6. Inspect the target project repo and confirm the agent can edit it.
7. Discover or set up a deploy path the agent can trigger from CLI.
8. Explain `OK`, `HOLD`, and `ASK`.
9. Confirm how post-deploy VCL replies and changelog updates will be posted.

## Manual equivalents

```bash
node scripts/poll-vcl-feedback.js
node scripts/poll-vcl-feedback.js --notify-openclaw
node scripts/handle-vcl-response.js "ASK 24 Could you clarify whether this issue is mobile-only?"
node scripts/vcl-api.js changelog --content "- Improved contrast" --linked-feedback-ids "24"
```
