# Quick onboarding

## Fastest path

1. Add your project to Vibe Coding List.
2. Open the project's **Agent API** tab.
3. Create a scoped API key with the permissions you need:
   - read feedback
   - reply to feedback
   - post changelog updates
4. Copy the curl example from that page into a local file.
5. Run:

```bash
node scripts/bootstrap-vcl-feedback-loop.js --curl-file ~/vcl-curl.txt
```

6. Verify read access:

```bash
node scripts/poll-vcl-feedback.js
node scripts/poll-vcl-feedback.js --message
node scripts/poll-vcl-feedback.js --new-message
```

7. If you want notifications:

```bash
node scripts/poll-vcl-feedback.js --notify-openclaw
```

8. Handle responses:

```bash
node scripts/handle-vcl-response.js "OK 24"
node scripts/handle-vcl-response.js "HOLD 24"
node scripts/handle-vcl-response.js "ASK 24 Could you clarify whether this issue is mobile-only?"
```

9. Post write-side follow-ups when needed:

```bash
node scripts/vcl-api.js reply --parent-id 24 --content "Thanks — this is fixed in the latest build."
node scripts/vcl-api.js changelog --content "- Improved contrast" --linked-feedback-ids "24"
```
