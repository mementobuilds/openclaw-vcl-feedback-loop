# OpenClaw VCL Feedback Loop

A deterministic, approval-gated feedback loop for **VibeCodingList (VCL)** projects running with **OpenClaw**.

This repo now covers both sides of the loop:

1. **Read from VCL**
   - poll Agent Insights / project feedback
   - detect what is new or still pending
   - notify a human through OpenClaw
2. **Write back to VCL**
   - reply inside feedback threads
   - ask clarifying questions
   - post changelog / update entries
   - link shipped updates back to the feedback that influenced them

It is intentionally **not** a fully autonomous coding bot.
The polling path is deterministic and cheap. No LLM is required just to detect new feedback.

**Best way to use this repo:** ask your own OpenClaw agent to set it up for you, then use the manual commands below only if you want to inspect or reproduce the setup by hand.

---

## Quick start

### Prompt-first quick start

1. Clone this repo somewhere OpenClaw can access it.
2. Add your project to VCL.
3. Open the project page → **Agent API**.
4. Create an API key with the scopes you want.
5. Copy the curl snippet from that tab.
6. Tell OpenClaw something like:

```text
Set up this VCL feedback loop for me. Use Telegram notifications. Here is the Agent API curl snippet: ...
```

The agent should then be able to bootstrap the local config, test the poller, add notify settings, and install the cron job with minimal manual work from the user.

### Manual fallback quick start

If you want to do the same setup by hand, this is the equivalent flow.

#### 1) Clone this repo

```bash
git clone https://github.com/mementobuilds/openclaw-vcl-feedback-loop.git
cd openclaw-vcl-feedback-loop
```

#### 2) Copy the curl example from the VCL project page

On the project page, open **Agent API** and copy the exact curl example into a local file:

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

#### 3) Bootstrap the config

```bash
node scripts/bootstrap-vcl-feedback-loop.js --curl-file ~/vcl-curl.txt
```

This writes a local config file to:

```text
~/.openclaw/workspace/.openclaw/vcl-feedback-loop.json
```

It extracts:

- the insights or feed URL
- the project API key

It prints only a **redacted** API key summary, not the full key.

#### 4) Verify connectivity

```bash
node scripts/poll-vcl-feedback.js
node scripts/poll-vcl-feedback.js --message
node scripts/poll-vcl-feedback.js --new-message
```

Expected behavior:

- JSON mode prints counts and the state path
- `--message` prints current pending items
- `--new-message` prints only pending items that have not yet been notified
- if there is nothing pending, message modes print `NO_NEW_FEEDBACK`

#### 5) Wire notifications to OpenClaw

If you already know the destination, include it during bootstrap:

```bash
node scripts/bootstrap-vcl-feedback-loop.js \
  --curl-file ~/vcl-curl.txt \
  --channel telegram \
  --target CHAT_ID \
  --account default
```

Or add it later to the config file.

### 6) Connect Telegram the same way as this example setup

This setup sends notifications through **OpenClaw's Telegram routing**, not by talking to Telegram directly from the script.

That means the important pieces are:

1. OpenClaw already has a Telegram account connected
2. you know the Telegram target chat or user id
3. the VCL loop config includes:
   - `channel: telegram`
   - `target: <CHAT_ID>`
   - usually `account: default`

You can bake that in during bootstrap:

```bash
node scripts/bootstrap-vcl-feedback-loop.js \
  --curl-file ~/vcl-curl.txt \
  --channel telegram \
  --target CHAT_ID \
  --account default
```

Or edit the config later:

```json
{
  "baseUrl": "https://YOUR-VCL-HOST",
  "projectId": 26,
  "apiKey": "YOUR_VCL_PROJECT_API_KEY",
  "notify": {
    "channel": "telegram",
    "target": "CHAT_ID",
    "account": "default"
  }
}
```

If the user wants the setup mostly by chat, the practical prompt is something like:

```text
Set this up with VCL alerts to my Telegram chat. My Telegram is already connected to OpenClaw.
```

If the Telegram account is not connected yet, handle that first in OpenClaw, then come back and finish the VCL loop setup.

### 7) Test notification delivery

```bash
node scripts/poll-vcl-feedback.js --notify-openclaw
```

This sends only **pending items that have not yet been marked as notified**.

### 8) Handle a response

Ack a handled item directly:

```bash
node scripts/ack-vcl-feedback.js 24
```

Or use the response parser:

```bash
node scripts/handle-vcl-response.js "OK 24"
node scripts/handle-vcl-response.js "HOLD 24"
node scripts/handle-vcl-response.js "ASK 24 Could you clarify whether this issue is mobile-only?"
```

---

## Requirements

- Node.js 18+ (Node 20+ recommended)
- OpenClaw installed and working
- a VCL project with Agent API access
- a VCL project API key
- the VCL example curl command from the project page

Optional but recommended:

- Telegram or another OpenClaw-routed destination for notifications
- cron on the machine
- a project-specific implementation/deploy script if you want full automation after approval

---

## Getting Agent API access in VCL

Once a project has been added to **VibeCodingList**, go to that project's page and open the **Agent API** tab.

There you can create a project API key scoped for actions like:

- **read feedback**
- **reply to feedback**
- **post updates in the changelog**

VCL also shows an example curl command there. That curl example is the easiest way to bootstrap this repo.

> Keep project API keys out of git-tracked files.

---

## Approval + reply model

The simplest safe convention is:

- `OK 24` → approved for implementation
- `HOLD 24` → do not implement now, but stop reminders
- `ASK 24 <question>` → ask a clarifying question back in the VCL thread

If more than one item is pending, always include the id.
If only one item is pending, plain `OK`, `HOLD`, or even a plain question can be inferred by `handle-vcl-response.js`.

Recommended sequence:

1. Poll and notify deterministically
2. Wait for explicit human approval or question
3. Map the response to a specific feedback id
4. Ack the item on `OK` or `HOLD`
5. Only after `OK` should downstream automation implement, test, deploy, and verify
6. After deploy, optionally post a thread reply and a changelog update linked to the feedback ids that influenced the change

---

## Real example: Tap Flash

A public example project using this style of workflow:

**Tap Flash — self-improving game**
<https://vibecodinglist.com/projects/tap-flash-self-improving-game>

The live Tap Flash workflow that inspired this repo currently supports:

- polling the VCL feed
- notifying a human when new feedback arrives
- `OK` / `HOLD` approval gating
- `ASK` clarification questions back into the thread
- replying after a requested change ships
- posting changelog updates after deploy
- linking changelog entries to the feedback that influenced the update

That broader end-to-end flow is why this repo now documents both the read side and the write side clearly.

---

## What problem this solves

If you wire VCL feedback straight into an LLM loop, things get messy fast:

- repeated alerts
- duplicate handling
- fuzzy state
- accidental auto-action without approval
- hard-to-debug polling behavior

This repo keeps the critical control plane simple and auditable:

**fetch → normalize → fingerprint → compare → notify → wait → ack / ask / reply / update**

That makes it much easier to trust.

---

## What this repo does

### Read-side / control-plane scripts

- `scripts/bootstrap-vcl-feedback-loop.js`
  - extracts the VCL URL + project API key from the curl example shown in the VCL UI
  - writes a minimal local config file
- `scripts/poll-vcl-feedback.js`
  - fetches feedback
  - tracks pending vs acked vs notified items
  - prints surfaced findings or sends them through OpenClaw
- `scripts/ack-vcl-feedback.js`
  - marks one or more feedback items as handled so reminders stop

### Write-side helper scripts

- `scripts/vcl-api.js`
  - replies to a feedback thread
  - asks a fresh clarification question
  - posts a changelog/update entry
  - can attach `linkedFeedbackIds` so the update shows which feedback influenced the shipped change
- `scripts/handle-vcl-response.js`
  - parses natural human responses like:
    - `OK 24`
    - `HOLD 24`
    - `ASK 24 Could you clarify whether this is mobile-only?`
    - or, when only one item is pending, even just a plain question

### Docs and examples

- copy-paste setup docs
- example config files
- safe cron example
- a real public example project: **Tap Flash**
  - <https://vibecodinglist.com/projects/tap-flash-self-improving-game>

---

## What this repo does **not** do

This repo does **not**:

- store secrets in git-tracked files
- auto-approve feedback
- auto-implement code changes without explicit human approval
- guess your deploy flow
- embed an LLM inside the polling loop

That last point is deliberate.

Use this repo for the **deterministic feedback/control layer**.
Then attach your own project-specific automation after approval.

---

## Current workflow model

```text
VCL project page
  └─ Agent API tab
       ├─ create scoped API key
       ├─ read feedback / replies
       ├─ reply to feedback threads
       └─ post changelog updates

         V
bootstrap-vcl-feedback-loop.js
  └─ saves local config

         V
poll-vcl-feedback.js
  ├─ fetches current VCL feed
  ├─ normalizes findings
  ├─ fingerprints the feed
  ├─ compares with local state
  ├─ identifies pending + unnotified items
  └─ sends a notification via OpenClaw

         V
Human replies
  ├─ OK <id>
  ├─ HOLD <id>
  └─ ASK <id> <question>

         V
handle-vcl-response.js / vcl-api.js
  ├─ ack handled items
  ├─ post clarifying questions
  ├─ post thread replies
  └─ post changelog updates linked to feedback ids

         V
(optional) project-specific implementation / test / deploy flow
```

---

## Recommended setup style: prompt-first, not terminal-first

The ideal experience is the same pattern used here:
**talk to OpenClaw and let the agent set it up for you.**

In practice, that means the human mostly provides:

- the VCL project page or curl snippet from the **Agent API** tab
- where notifications should go
- whether they want Telegram alerts
- whether they want `OK / HOLD / ASK` handling and post-deploy replies/changelog updates

Then the agent can do the setup work:

- create the local config
- wire the VCL URL and API key into the config
- add Telegram notify settings
- test polling
- test notifications
- add the cron job
- explain how to reply with `OK`, `HOLD`, or `ASK`

### Good example prompts

```text
Set up the VCL feedback loop for my project using this Agent API curl snippet. Notify me on Telegram.
```

```text
I added my project to VibeCodingList. Help me connect the Agent API, send feedback alerts to Telegram, and support OK / HOLD / ASK replies.
```

```text
Use this repo to set up the same workflow you built for Tap Flash: polling, Telegram alerts, approval gating, thread replies, and changelog updates.
```

The manual CLI examples below still matter, but they should be treated as the **fallback path** or the documentation for what the agent is doing on your behalf.

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

### `handle-vcl-response.js`

Parse human responses and do the right thing:

```bash
node scripts/handle-vcl-response.js "OK 24"
node scripts/handle-vcl-response.js "HOLD 24"
node scripts/handle-vcl-response.js "ASK 24 Could you clarify whether this is mobile-only?"
```

If exactly one item is pending, these also work:

```bash
node scripts/handle-vcl-response.js "OK"
node scripts/handle-vcl-response.js "HOLD"
node scripts/handle-vcl-response.js "Could you ask whether this is only happening on Safari?"
```

### `vcl-api.js`

Reply to a feedback thread:

```bash
node scripts/vcl-api.js reply --parent-id 24 --content "Thanks — this is fixed in the latest build."
```

Ask a new clarification question:

```bash
node scripts/vcl-api.js ask --content "Could someone confirm whether this issue is reproducible on mobile too?"
```

Post a changelog/update entry:

```bash
node scripts/vcl-api.js changelog \
  --content "- Improved contrast on the HUD\n- Reduced accidental taps near the edge" \
  --linked-feedback-ids "24,26"
```

Post a changelog/update entry with a follow-up request for more feedback:

```bash
node scripts/vcl-api.js changelog \
  --content "- Added a clearer restart state after misses" \
  --linked-feedback-ids "31" \
  --feedback-request "Would love feedback on whether the restart flow now feels obvious on mobile."
```

The `linkedFeedbackIds` field is what lets the changelog entry show which feedback influenced the update.

---

## Suggested project layout when you extend this

This repo is the reusable core.
For a full end-to-end implementation loop, keep your project-specific logic separate:

```text
my-project/
  scripts/
    implement-approved-change.js
    deploy-and-verify.js
    finalize-approved-feedback.js
  .openclaw/
    vcl-feedback-loop.json
```

That keeps the generic feedback/state layer reusable while letting each project define its own coding, testing, deploy, and release behavior.

---

## Recommended end-to-end pattern

A strong practical pattern is:

1. `poll-vcl-feedback.js --notify-openclaw`
2. human replies `OK`, `HOLD`, or `ASK`
3. `handle-vcl-response.js` parses the reply
4. your project-specific automation implements the approved change
5. your project-specific deploy verification runs
6. `vcl-api.js reply ...` posts back into the original thread
7. `vcl-api.js changelog ... --linked-feedback-ids ...` posts a release/update entry showing what feedback influenced the change

That pattern stays safe because the expensive or creative parts happen **after** a clear human decision.

### Recommended user experience

The default setup in this repo assumes:

- the VCL project already exists
- the Agent API key comes from the VCL project page
- OpenClaw is already installed
- Telegram is already connected to OpenClaw
- the user mostly interacts by chat, not by shell
- the user's own agent does the setup work and only asks for the missing inputs

So the practical user experience should feel like:

```text
User: Set up the VCL feedback loop for my project.
Agent: Send me the Agent API curl snippet and tell me which Telegram chat to notify.
User: [provides snippet / destination]
Agent: I’ll wire the config, test polling, test Telegram delivery, and set up the 5-minute cron.
```

That is the recommended UX for this repo.
Tap Flash is included as a public example of this workflow, not as a separate mode or special configuration.
The manual commands in this README exist so the setup remains inspectable and reproducible, but the preferred path is still **prompt the agent and let it do the work**.

---

## Troubleshooting

### `Missing VCL config`

You have not provided enough config for the script you are running.
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
- the selected `channel` / `account` is valid

### Repeated reminders for the same item

That usually means the finding has not been acked yet.
Run:

```bash
node scripts/ack-vcl-feedback.js <id>
```

or:

```bash
node scripts/handle-vcl-response.js "OK <id>"
```

### Write actions fail

Check:

- the project API key has the needed scope
- the project id is correct
- the Agent API tab is enabled for that project
- you are posting to the right VCL host

### Config already exists

The bootstrap script refuses to overwrite an existing config by default.
Use `--force` only if you intentionally want to replace it:

```bash
node scripts/bootstrap-vcl-feedback-loop.js --curl-file ~/vcl-curl.txt --force
```

---

## Security notes

- keep VCL API keys out of git-tracked files
- prefer local config or environment variables
- keep the polling loop deterministic and auditable
- require explicit human approval before implementation or deploy steps
- do not let downstream coding/deploy automation run automatically just because polling found a new item

---

## Who this is for

This repo is a good fit if you want:

- VCL feedback notifications in Telegram or another OpenClaw-routed channel
- deterministic state management
- deduplicated notifications
- a clean approval gate before code changes happen
- the ability to ask follow-up questions in VCL threads
- the ability to post shipped updates back to VCL and link them to the feedback that inspired them

It is especially useful if you want a workflow like:

> VCL feedback arrives → notify me immediately → I reply OK / HOLD / ASK → only then does an agent implement and deploy → then the system replies in-thread and posts a changelog update linked to the influencing feedback.

---

## License

MIT
