# Quick onboarding

## Fastest path

1. Copy the VCL curl example from the builder UI into a local file.
2. Run:

```bash
node scripts/bootstrap-vcl-feedback-loop.js --curl-file ~/vcl-curl.txt
```

3. Verify:

```bash
node scripts/poll-vcl-feedback.js
node scripts/poll-vcl-feedback.js --message
node scripts/poll-vcl-feedback.js --new-message
```

4. If you want notifications:

```bash
node scripts/poll-vcl-feedback.js --notify-openclaw
```

5. After you decide what to do with a finding:

```bash
node scripts/ack-vcl-feedback.js 24
```
