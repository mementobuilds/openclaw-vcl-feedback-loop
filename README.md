# OpenClaw VCL Feedback Loop

A deterministic, approval-gated feedback loop for **Vibe Coding List (VCL)** projects running with **OpenClaw**.

This repo gives you the safe, reusable part of the workflow:

1. **Poll VCL Agent Insights** for feedback
2. **Detect what is new or still pending**
3. **Notify you through OpenClaw**
4. **Wait for explicit human approval** (`OK <id>` / `HOLD <id>`)
5. **Ack handled items** so reminders stop

It is intentionally **not** a fully autonomous coding bot.
The polling path is deterministic and cheap. No LLM is required just to detect new feedback.

---

## Why this exists

If you wire VCL feedback directly into an LLM loop, things get messy fast:

- repeated alerts
- duplicate handling
- unclear state
- accidental auto-action without approval
- hard-to-debug polling behavior

This repo keeps the critical loop simple and auditable:

**fetch → normalize → fingerprint → compare → notify → wait → ack**

That makes it much easier to trust.

---

## What you get

- `scripts/bootstrap-vcl-feedback-loop.js`
  - Extracts the VCL insights URL + API key from the curl example shown in the VCL UI
  - Writes a minimal local config file
- `scripts/poll-vcl-feedback.js`
  - Fetches feedback
  - Tracks pending vs acked vs notified items
  - Prints messages or sends them via OpenClaw
- `scripts/ack-vcl-feedback.js`
  - Marks one or more feedback items as handled so reminders stop
- copy-paste setup docs
- example config files
- safe cron example

---

## What this does **not** do

This repo does **not**:

- store secrets in git-tracked files
- auto-approve feedback
- auto-implement code changes without explicit human approval
- guess your deploy flow
- embed an LLM inside the polling loop

That last point is deliberate.

Use this repo for the **deterministic control plane**.
Then attach your own project-specific automation after approval.

---

## Architecture

```text
VCL Agent Insights
        |
        v
poll-vcl-feedback.js
  - fetches feed
  - normalizes findings
  - computes fingerprint
  - compares to local state
  - identifies pending/unnotified items
        |
        v
OpenClaw notification
        |
        v
Human replies: OK <id> / HOLD <id>
        |
        v
ack-vcl-feedback.js
        |
        v
(optional) project-specific implementation/deploy/reply flow
```

---

## Requirements

- Node.js 18+ (Node 20+ recommended)
- OpenClaw installed and working
- A VCL project with Agent Insights enabled
- The VCL **project API key**
- The VCL **example curl command** from the builder UI

Optional but recommended:

- a Telegram or other OpenClaw-routed destination for notifications
- cron available on the machine

---

## Quick start

### 1) Clone this repo

```bash
git clone https://github.com/mementobuilds/openclaw-vcl-feedback-loop.git
cd openclaw-vcl-feedback-loop
```

### 2) Copy the curl example from VCL into a file

In the VCL UI, copy the exact example curl command into a local file:

```bash
nano ~/vcl-curl.txt
```

It should look roughly like this:

```bash
curl --request GET \
  --url "https://YOUR-VCL-HOST/api/project-intelligence/v1/projects/26/insights?range=30d&source=all" \
  --header "x-project-api-key: YOUR_PROJECT_API_KEY" \
  --header "Accept: application/json"
```

### 3) Bootstrap the config

```bash
node scripts/bootstrap-vcl-feedback-loop.js --curl-file ~/vcl-curl.txt
```

This writes a local config file to:

```text
~/.openclaw/workspace/.openclaw/vcl-feedback-loop.json
```

It extracts:

- the insights URL
- the project API key

It prints only a **redacted** API key summary, not the full key.

### 4) Verify connectivity

```bash
node scripts/poll-vcl-feedback.js
node scripts/poll-vcl-feedback.js --message
node scripts/poll-vcl-feedback.js --new-message
```

Expected behavior:

- JSON mode prints counts and state path
- `--message` prints current pending items
- `--new-message` prints only pending items that have not yet been notified
- if there is nothing pending, message modes print `NO_NEW_FEEDBACK`

### 5) Wire notifications to OpenClaw

If you already know the destination, you can include it during bootstrap:

```bash
node scripts/bootstrap-vcl-feedback-loop.js \
  --curl-file ~/vcl-curl.txt \
  --channel telegram \
  --target CHAT_ID \
  --account default
```

Or add it later to the config file.

### 6) Test notification delivery

```bash
node scripts/poll-vcl-feedback.js --notify-openclaw
```

This sends only **pending items that have not yet been marked as notified**.

### 7) Ack handled feedback

After you decide what to do with a finding:

```bash
node scripts/ack-vcl-feedback.js 24
```

Or ack several at once:

```bash
node scripts/ack-vcl-feedback.js 24 25 26
```

---

## Recommended human approval flow

The simplest safe convention is:

- `OK 24` → approved for implementation
- `HOLD 24` → do not implement now, but stop reminders

If you have more than one pending item, always include the id.
If there is only one pending item, plain `OK` / `HOLD` may be okay in your own project, but explicit ids are better.

Recommended sequence:

1. Poll and notify deterministically
2. Wait for explicit human approval
3. Map the approval to a specific finding id
4. Ack the finding with `ack-vcl-feedback.js <id>`
5. Only after `OK` should downstream automation implement, test, deploy, and reply back to VCL

---

## Config

Default config path:

```text
~/.openclaw/workspace/.openclaw/vcl-feedback-loop.json
```

### Minimal config using a full URL

```json
{
  "url": "https://YOUR-VCL-HOST/api/project-intelligence/v1/projects/26/insights?range=30d&source=all",
  "apiKey": "YOUR_VCL_PROJECT_API_KEY"
}
```

### Minimal config using base URL + project id

```json
{
  "baseUrl": "https://YOUR-VCL-HOST",
  "projectId": 26,
  "apiKey": "YOUR_VCL_PROJECT_API_KEY",
  "range": "30d",
  "source": "all"
}
```

### Config with OpenClaw notifications

```json
{
  "baseUrl": "https://YOUR-VCL-HOST",
  "projectId": 26,
  "apiKey": "YOUR_VCL_PROJECT_API_KEY",
  "notify": {
    "channel": "telegram",
    "target": "CHAT_OR_USER_ID",
    "account": "default"
  }
}
```

> Do not commit real API keys, chat ids, or other secrets to git.

---

## Environment variables

These scripts can be driven by config, environment variables, or CLI flags.

### VCL config

- `VCL_FEEDBACK_CONFIG_PATH`
- `VCL_FEEDBACK_STATE_PATH`
- `VCL_FEEDBACK_URL`
- `VCL_FEEDBACK_API_KEY`
- `VCL_BASE_URL`
- `VCL_PROJECT_ID`
- `VCL_RANGE`
- `VCL_SOURCE`

### OpenClaw notification config

- `OPENCLAW_NOTIFY_CHANNEL`
- `OPENCLAW_NOTIFY_TARGET`
- `OPENCLAW_NOTIFY_ACCOUNT`
- `OPENCLAW_BIN`
- `VCL_MAX_ITEMS_PER_MESSAGE`

CLI flags override config for the current run.

---

## Cron

A safe starting interval is every **5 minutes**.

Example:

```cron
*/5 * * * * cd /ABSOLUTE/PATH/TO/openclaw-vcl-feedback-loop && /usr/bin/node scripts/poll-vcl-feedback.js --notify-openclaw >> ~/.openclaw/workspace/.state/vcl-feedback-loop-cron.log 2>&1
```

Adjust the Node path if your environment uses a different one.

---

## Script reference

### `bootstrap-vcl-feedback-loop.js`

Bootstrap a config from the VCL curl snippet:

```bash
node scripts/bootstrap-vcl-feedback-loop.js --curl-file ~/vcl-curl.txt
```

Or pass values directly:

```bash
node scripts/bootstrap-vcl-feedback-loop.js \
  --url https://YOUR-VCL-HOST/api/project-intelligence/v1/projects/26/insights?range=30d&source=all \
  --api-key YOUR_PROJECT_API_KEY
```

Optional notify wiring:

```bash
node scripts/bootstrap-vcl-feedback-loop.js \
  --curl-file ~/vcl-curl.txt \
  --channel telegram \
  --target CHAT_ID \
  --account default
```

### `poll-vcl-feedback.js`

Plain JSON status:

```bash
node scripts/poll-vcl-feedback.js
```

Show current pending findings:

```bash
node scripts/poll-vcl-feedback.js --message
```

Show only unnotified pending findings:

```bash
node scripts/poll-vcl-feedback.js --new-message
```

Send notification through OpenClaw:

```bash
node scripts/poll-vcl-feedback.js --notify-openclaw
```

### `ack-vcl-feedback.js`

Ack a handled finding:

```bash
node scripts/ack-vcl-feedback.js 24
```

Ack multiple findings:

```bash
node scripts/ack-vcl-feedback.js 24 25
```

---

## Suggested project layout when you extend this

This repo is the reusable core.
For a full end-to-end implementation loop, keep your project-specific logic separate:

```text
my-project/
  scripts/
    parse-approval-reply.js
    implement-approved-change.js
    deploy-and-verify.js
    reply-to-vcl-thread.js
  .openclaw/
    vcl-feedback-loop.json
```

That keeps the generic polling/state layer reusable while letting each project define its own coding, testing, deploy, and changelog behavior.

---

## Troubleshooting

### `Missing VCL config`

You have not provided enough config for the poller.
Use one of:

- `url + apiKey`
- `baseUrl + projectId + apiKey`

### `NO_NEW_FEEDBACK`

This is not an error.
It means there are no pending, unnotified findings right now.

### Notification send fails

Check:

- OpenClaw is installed and on PATH
- `openclaw message send` works in your environment
- the `notify.target` is correct
- the selected `channel`/`account` is valid

### Repeated reminders for the same item

That usually means the finding has not been acked yet.
Run:

```bash
node scripts/ack-vcl-feedback.js <id>
```

### Config already exists

The bootstrap script refuses to overwrite an existing config by default.
Use `--force` only if you intentionally want to replace it:

```bash
node scripts/bootstrap-vcl-feedback-loop.js --curl-file ~/vcl-curl.txt --force
```

---

## Security notes

- Keep VCL API keys out of git-tracked files
- Prefer local config or environment variables
- Keep the polling loop deterministic and auditable
- Require explicit human approval before implementation or deploy steps
- Do not let downstream coding/deploy automation run automatically just because polling found a new item

---

## Who this is for

This repo is a good fit if you want:

- VCL feedback notifications in Telegram or another OpenClaw-routed channel
- deterministic state management
- deduplicated notifications
- a clean approval gate before code changes happen

It is especially useful if you are building a workflow like:

> VCL feedback arrives → notify me immediately → I reply OK/HOLD → only then does an agent implement and deploy.

---

## License

MIT
