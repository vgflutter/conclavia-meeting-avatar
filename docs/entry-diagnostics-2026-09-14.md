# Entry diagnostics

The September 14 evening attempts reached Attendee's `joining` state but never reported `waiting_room` or `joined_*`. Conclavia requested departure after its two-minute deadline. That establishes the timeout, **not the reason the browser failed to enter Teams**. The recognition issue is separate and remains open.

## Read the current attempt

```bash
npm run diagnose:entry -- <meeting-id>
```

Use the Conclavia meeting ID from its detail-page URL, not a Teams meeting ID or an Attendee bot ID. This command only performs a loopback GET to `/api/meetings/<id>/diagnostics`. It does not load API credentials, create/join/leave a bot, generate speech, or call AI. The route never polls/reconciles Attendee or changes meeting state. It is explicitly local-only and returns `Cache-Control: no-store`.

The report includes the current attempt/bot IDs, locally observed provider status, entry/renderer/exit timestamps, subscription acknowledgement, and stored diagnostic messages. It excludes invitation URLs, avatar capabilities, context, transcripts and credentials. `requested` means the creation response acknowledged a payload containing the log subscription; it does not prove log delivery or Teams admission. An empty log list is not a healthy result.

## Attendee diagnostic events

New bot creation requests include `bot_logs.update` alongside existing state, transcript and participant subscriptions. Existing bots are not silently recreated/reconfigured. A bot created before this change will show `not_confirmed_for_this_attempt`; logs from past attempts cannot be reconstructed retroactively.

The webhook authenticates the existing signature/token and checks bot + attempt identity before storage. Logs are processed before the terminal-state guard so errors delivered after timeout/exit remain available for that same attempt. They never bind a bot, mark it joined, append a transcript, trigger speech, or enter model context. Foreign/replaced attempts are ignored. A retry cannot relabel old logs as new evidence.

Storage is a separate `MeetingDiagnostic` MongoDB collection: up to **100 latest received entries per bot/attempt**, duplicate provider IDs suppressed within that retained window, maximum 2,048 characters per sanitized message, seven-day expiry from first receipt. An index handles eventual TTL deletion; the read endpoint also excludes expired records immediately. Previous-attempt records remain bounded by that expiry but the endpoint displays only the current attempt. A storage failure returns 503 so Attendee can retry; malformed diagnostics return 400.

This is a single-workspace local PoC, not tenant-authenticated remote diagnostics. Do not expose management routes directly on the internet.

## Local app and tunnel logs

The updated `npm run tunnel` captures child app/cloudflared stdout and stderr into:

- `.conclavia/logs/runtime.log`
- `.conclavia/logs/runtime.log.1` (one rotated predecessor)

Each file rotates at 1 MiB, has mode 0600, and lives in a 0700 logs directory already excluded from Git. Symlink/hardlink log targets are refused. Pending writes and input lines are bounded. Full lines are reconstructed before redaction, so split chunks cannot expose a partial token; oversized lines and incomplete EOF tails are omitted. The launcher reports a write failure instead of dumping raw output.

URLs, capabilities, credential fields/headers, opaque long strings, emails and local user paths are redacted; payload/context/transcript dumps are omitted. This is defensive filtering, not a guarantee arbitrary free-text diagnostics contain no personal data. Review even redacted logs before sharing externally. No raw fallback file is saved.

Only children started by the updated launcher are captured. Hot reload updates application routes but cannot retrofit logging into an already-running launcher; restart that verified local launcher with no active bots, then verify public health/management blocking again. Reusing an independently started app does not attach to its stdout.

No debug video recording has been enabled. Recording the provider browser is a separate diagnostic step with privacy implications. If Attendee emits no useful diagnostic event, its browser screenshot/internal logs or provider support are still needed; adding a subscription alone does not fix or explain entry failures.

## Verification

```bash
npm run test:diagnostics
npm run test:tunnel
npm run test:e2e -- tests/e2e/meeting-diagnostics.spec.ts tests/e2e/meeting-entry.spec.ts tests/e2e/meeting-output-health.spec.ts
npm run typecheck -- --incremental false
npm run lint
```

Fixtures use an isolated database and mocked provider transport: no paid bots, voice or AI. Coverage includes webhook authentication, wrong attempts/bots, duplicate deliveries, logs after timeout, creation races, bounded storage/TTL, public-host denial, secret redaction across chunks, private file permissions, rotation and symlink refusal. These checks verify diagnostic plumbing, **not real Teams entry, caption language or received audio/video**.

Verified on September 14: 86 integration checks, 5 diagnostic-script checks and 23 tunnel-script checks passed, plus typecheck and lint. The verified inactive local launcher was restarted; app and Cloudflare records are present in a mode-0600 log. The read-only command works against an existing historical meeting and correctly reports that its old attempt did not request diagnostic logs. Public avatar page/state/JavaScript checks returned 200; public diagnostics returned 404. No new remote bot or debug recording was created. A new real attempt is still required to observe hosted Attendee diagnostic delivery and investigate the entry failure.

Sources: [Attendee diagnostic webhook payload and delivery priority](https://docs.attendee.dev/guides/webhooks), [bot creation and opt-in debug recording](https://docs.attendee.dev/api-reference/tag/bots/post/api/v1/bots).
