# OpenClaw VCL Feedback Loop

A deterministic, approval-gated feedback loop for **VibeCodingList (VCL)** projects running with **OpenClaw**.

This repo now covers both sides of the loop:

1. **Read from VCL**
   - poll Agent Insights / project feedback
   - detect what is new or still pending
   - notify a human through OpenClaw
2. **Write back to VCL**
   - reply inside feedback threads when the source type supports replies
   - ask clarifying questions on replyable feedback threads
   - post changelog / update entries
   - link shipped updates back to the feedback that influenced them

It is intentionally **not** a fully autonomous coding bot.
The polling path is deterministic and cheap. No LLM is required to detect new feedback.

**Best way to use this repo:** ask your own OpenClaw agent to set it up for you, then use the reference below only if you want to inspect or reproduce the setup by hand.

---

## Live example

Example:
<https://vibecodinglist.com/projects/tap-flash-self-improving-game>

---

## Quick start

If you do not have OpenClaw yet, start here:
- GitHub: <https://github.com/openclaw/openclaw>
- Docs: <https://docs.openclaw.ai>

### Prompt-first quick start

1. If your project is not on VCL yet, submit it here:
   <https://vibecodinglist.com/submit>
2. Open the project page → **Agent API**.
3. Create one API key with the scopes you want:
   - `project_intelligence:read`
   - `project_intelligence:write_feedback`
   - `project_intelligence:write_updates`
4. If you want Telegram alerts:
   - connect Telegram to OpenClaw first
   - if alerts should go to a group, add the bot there
   - if the agent cannot infer the destination, provide the numeric chat id
5. Make sure the target project itself is reachable by the agent:
   - the source repo exists (GitHub or another accessible git remote)
   - OpenClaw can clone or access that repo
   - there is a deploy path the agent can trigger from CLI after making fixes
6. Then send your OpenClaw agent a prompt like this:

Example prompt:

```text
Clone https://github.com/mementobuilds/openclaw-vcl-feedback-loop
and set up the full VCL workflow for my project.

My VCL project is:
https://vibecodinglist.com/projects/my-project

This is the API key:
...

The target project repo is:
https://github.com/me/my-project

I want Telegram alerts.
I want approved fixes to be implemented, committed, deployed,
and only marked as shipped after the live public deployment is verified.
Then post back to VCL as thread replies when the source supports replies,
and post changelog updates linked to the feedback ids that influenced them.

If anything is missing, figure out what you can automatically
and ask me only for the remaining required inputs.
```

Recommended setup style: prompt-first, not terminal-first.

The ideal experience is: talk to OpenClaw and let the agent set it up for you.
The human mostly provides:
- the VCL project page or the Agent API curl snippet
- where notifications should go
- whether they want Telegram alerts
- whether they want OK / HOLD / ASK handling and post-deploy replies / changelog updates

The reference below is the fallback path. It is mainly there for inspection, debugging, or reproducing what the agent is doing on the user's behalf.

---

## Requirements

Required:
- Node.js 18+ (Node 20+ recommended)
- OpenClaw installed and working
- a VCL project with Agent API access
- a VCL project API key

Optional but usually needed for the full workflow:
- Telegram or another OpenClaw-routed destination for notifications
- access to the target project source repo
- a deploy method the agent can trigger after making approved fixes
- a public URL or other deploy-verification path
- cron on the machine

---

## Optional public X/Twitter feedback

VCL stays the structured feedback source for this loop. If your launch also
gets public feedback on X/Twitter, pair this repo with
[TweetClaw](https://github.com/Xquik-dev/tweetclaw), the `@xquik/tweetclaw`
OpenClaw plugin for Xquik workflows:

```bash
openclaw plugins install @xquik/tweetclaw
```

Use TweetClaw to search tweets, search tweet replies, run follower export,
perform user lookup, monitor tweets, and collect public launch signals before
you decide whether to reply in VCL, post a changelog update, or hold a fix for
later. Keep TweetClaw credentials in its own OpenClaw plugin config; do not add
X/Twitter credentials or Xquik API keys to the VCL config file.

---

## Minimal config

Save local config at:

```text
~/.openclaw/workspace/.openclaw/vcl-feedback-loop.json
```

Minimal config:

```json
{
  "baseUrl": "https://vibecodinglist.com",
  "projectId": 438,
  "apiKey": "YOUR_VCL_PROJECT_API_KEY"
}
```

With Telegram alerts through OpenClaw:

```json
{
  "baseUrl": "https://vibecodinglist.com",
  "projectId": 438,
  "apiKey": "YOUR_VCL_PROJECT_API_KEY",
  "notify": {
    "channel": "telegram",
    "target": "CHAT_ID",
    "account": "default"
  }
}
```

Notes:
- get `projectId` from the Agent API **Read insights** curl template (`/projects/<id>/...`)
- or resolve a public slug with `curl https://vibecodinglist.com/api/projects/by-slug/<slug>`
- Telegram delivery uses **OpenClaw routing**, so OpenClaw must already have a reachable Telegram account connected

---

## Command reference

Bootstrap config from the Agent API curl template:

```bash
node scripts/bootstrap-vcl-feedback-loop.js --curl-file ~/vcl-curl.txt
```

Include Telegram settings during bootstrap:

```bash
node scripts/bootstrap-vcl-feedback-loop.js \
  --curl-file ~/vcl-curl.txt \
  --channel telegram \
  --target CHAT_ID \
  --account default
```

Poll current status:

```bash
node scripts/poll-vcl-feedback.js
```

Show current pending items:

```bash
node scripts/poll-vcl-feedback.js --message
```

Show only not-yet-notified pending items:

```bash
node scripts/poll-vcl-feedback.js --new-message
```

Send notifications through OpenClaw:

```bash
node scripts/poll-vcl-feedback.js --notify-openclaw
```

Ack handled feedback:

```bash
node scripts/ack-vcl-feedback.js 24
```

Parse simple human responses:

```bash
node scripts/handle-vcl-response.js "OK 24"
node scripts/handle-vcl-response.js "HOLD 24"
node scripts/handle-vcl-response.js "ASK 24 Could you clarify whether this issue is mobile-only?"
```

Note: `ASK` / thread replies are for replyable VCL feedback threads. Mission-submission findings can still be approved and shipped, but they should skip the reply step and use a changelog / update post instead.

Post back into VCL:

```bash
node scripts/vcl-api.js reply ...
node scripts/vcl-api.js changelog ... --linked-feedback-ids ...
```

---

## Approval format

Use these reply conventions:

- `OK 24` → approved for implementation
- `HOLD 24` → do not implement now, but stop reminders
- `ASK 24 <question>` → ask a clarifying question back in the VCL thread when that source supports replies

If more than one item is pending, include the id.

---

## Safety rules

- do not store secrets in git-tracked files
- do not auto-approve feedback
- do not auto-implement code changes without explicit human approval
- do not mark a change as shipped until live deploy verification has passed
- do not attempt thread replies for non-replyable source types such as `mission_submission`; use changelog / update posts instead
- do not embed an LLM inside the polling loop

---

## Troubleshooting

Common issues:
- bad API key or wrong project id
- Telegram target missing or not reachable by the connected OpenClaw account
- target repo exists but the agent cannot access or clone it
- deploy path exists but cannot be triggered from CLI
- `NO_NEW_FEEDBACK` because there is nothing pending right now
