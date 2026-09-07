# Shared meeting memory

Conclavia can retain useful knowledge across meetings without carrying an
ever-growing transcript inside every model request. MongoDB is optional: when it
is not configured, the companion continues to use its bounded in-memory meeting
context exactly as before.

## Memory boundaries

Every record belongs to three explicit scopes:

1. `workspaceId` identifies the company, tenant, or team;
2. `projectId` identifies the shared topic or working group;
3. `sessionId` identifies one meeting.

Mary can recall information only from the same workspace and project, and never
from the active session as if it came from an earlier meeting. The environment
variables are the first deployment mechanism. In a multi-tenant product they
should be derived from the authenticated organization and selected workspace,
not accepted blindly from a browser.

## Data model

Three collections keep source evidence separate from derived knowledge:

| Collection | Purpose |
| --- | --- |
| `meeting_memory_sessions` | Meeting identity, scope, timing, summary, and lifecycle |
| `meeting_transcript_segments` | Immutable final speech/chat segments with speaker and timestamp |
| `shared_meeting_memories` | Decisions, actions, facts, risks, open questions, and summaries |

Raw segments are written as soon as they become final. Selecting **New session**
or stopping the companion closes the current session and creates a compact
snapshot with structured model output. Each extracted item carries confidence
and source segment IDs. Greetings, repetitions, jokes, and Mary's own audio echo
are explicitly excluded from durable memory.

Long meetings are split into bounded chronological chunks during compaction, so
early decisions are not lost merely because the live prompt retains only recent
turns. An interrupted process is also recoverable: unfinished sessions are found
and compacted on the next start because the raw segments were already saved.

## Recall

Cross-meeting retrieval is deliberately opt-in through a direct history
question, for example:

- `Mary, cosa avevamo deciso su Kubernetes?`
- `Mary, quali azioni sono rimaste aperte?`
- `Mary, cosa era emerso nello scorso meeting sul budget?`

The query is reduced to a memory kind, status, and meaningful subject terms.
Conclavia retrieves at most eight matching records, labels them as shared memory,
and includes their meeting title and date in the model context. Generic requests
such as “what did we decide?” use the most recent decisions rather than a noisy
full-text query. This is indexed lexical retrieval; semantic embeddings can be
added later without changing the memory contract.

Current-meeting summaries remain separate: `Mary, riassumi la discussione`
summarizes the active session, while explicit historical wording activates
shared recall.

## Configuration

Put the existing Conclavia Mongo URI only in the ignored `.env` file:

```dotenv
# Either variable is accepted; the dedicated one takes precedence.
CONCLAVIA_MEMORY_MONGODB_URI=mongodb+srv://...
# MONGODB_URI=mongodb+srv://...

CONCLAVIA_MEMORY_MONGODB_DATABASE=conclavia
CONCLAVIA_MEMORY_WORKSPACE_ID=hellfire
CONCLAVIA_MEMORY_PROJECT_ID=platform-modernization
CONCLAVIA_MEMORY_RETENTION_DAYS=365
```

`CONCLAVIA_MEMORY_RETENTION_DAYS=0` disables automatic expiry. A positive value
creates Mongo TTL indexes for sessions, raw transcripts, and derived memories.
The URI is never exposed through the public configuration or diagnostics APIs.

The diagnostic view reports only whether memory is active, its non-secret scope,
the number of persisted segments, and compaction state. Read-only operational
endpoints are also available:

```text
GET /api/memory/status
GET /api/memory/search?q=decisione%20Kubernetes&limit=8
```

## Privacy and production hardening

Participants must be told when transcription and persistent memory are active.
Production deployments should derive scope from authenticated tenant membership,
restrict Mongo network access, encrypt backups, audit recall, and use a retention
period approved by the organization. Deleting a UI session clears the current
conversation but intentionally does not delete the shared project record; data
deletion should be a separate authorized administrative operation.
