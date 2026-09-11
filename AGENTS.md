<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working directory

- This repository, `conclavia-meeting-avatar`, is the single working copy of the meeting assistant. Run development, tests, builds, and Git operations from this repository.
- `../conclavia-frontend` is a historical local backup, not a source or mirror. Do not synchronize changes back to it.
- The local runtime configuration is `.env.local` at this repository root. Preserve it when updating or installing dependencies; `.env.example` is only a template for new installations.
- Meetings, series, memory, and the avatar profile remain in the MongoDB database configured by the local environment. Do not create an empty replacement database during setup.

# Authorized local test recovery

- The user has authorized restoring this existing local test server and its temporary HTTPS tunnel without asking for confirmation again. Validate the exact processes before restarting them, preserve all unrelated `.env.local` settings, and verify both public avatar reachability and blocked public management routes afterward.
- This permission is limited to the same local test environment. It does not authorize a new paid deployment, bypassing Teams admission, or creating duplicate meeting participants. Report what was restored and distinguish connectivity checks from a successful real Teams conversation.

# AWS Guidance

- Prefer the AWS MCP Server for AWS interactions — it provides sandboxed
  execution, observability, and audit logging. If unavailable, use the
  AWS CLI directly.
- Before starting a task, check whether a relevant AWS skill is available.
  Load the skill with `retrieve_skill` and prefer its guidance over
  general knowledge.
- When uncertain about specific AWS details (API parameters, permissions,
  limits, error codes), verify against documentation rather than guessing.
  State uncertainty explicitly if you cannot confirm.
- When creating infrastructure, prefer infrastructure-as-code (AWS CDK or
  CloudFormation) over direct CLI commands.
- When working with infrastructure, follow AWS Well-Architected Framework
  principles.
- Do not use em dashes in AWS resource names or descriptions. Use
  hyphens instead.

## Secret Safety

- MUST load the `aws-secrets-manager` skill first for any secret,
  credential, API key, token, or password task. MUST NOT call
  `secretsmanager get-secret-value` or `batch-get-secret-value`, and MUST
  NOT hit the Secrets Manager Agent daemon directly. MUST use
  `{{resolve:secretsmanager:secret-id:SecretString:json-key}}` with
  `asm-exec` so the secret resolves at runtime without entering context.
