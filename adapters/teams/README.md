# Microsoft Teams chat adapter

Two integrations share the same canonical companion endpoint:

- the included Chrome bridge is immediately testable in Microsoft Teams Web;
- the installed Teams agent with resource-specific consent is the production path for Teams desktop and managed tenants.

## Teams Web bridge

The Manifest V3 extension is limited to the Microsoft Teams web domains and to the loopback companion at `http://127.0.0.1:4310/*`. It reads only newly rendered messages from the open meeting-chat panel, forwards them to `POST /api/chat/messages`, and publishes returned `outboundMessages` through the same composer. Existing messages are baselined instead of replayed, and avatar-authored echoes are suppressed.

1. Start the local companion on port `4310`.
2. Run `npm run teams:bridge:open`.
3. Enable **Developer mode** in `chrome://extensions`.
4. Select **Load unpacked** and choose `adapters/teams/extension`.
5. Reload Teams Web, enter the meeting, and keep the meeting chat open.
6. After the badge becomes `ON`, send a new message such as `Mary, alza la mano`.

The badge reports `ON` when Mary can see the chat, `OPEN` when the meeting chat is closed, `OFF` when the bridge is paused, and `ERR` when the companion is unavailable. Clicking the extension action pauses or resumes ingestion. Teams markup is private and may change; all selectors therefore remain isolated in `extension/teams-dom.js`.

## Production Teams agent

The repository includes a production agent runtime at `src/teams/teams-agent.ts`, built on Microsoft's current `@microsoft/teams.apps` SDK. It accepts authenticated Teams activities at `/api/messages`, maps them to the same canonical chat contract, suppresses its own echoes, and sends Mary's returned chat messages back through Teams. Run it locally with `npm run teams:agent:dev` or build first and run `npm run teams:agent:start`.

The app is installed in the meeting group chat or team. The template manifest declares `groupchat` and `team` agent scopes plus the resource-specific `ChatMessage.Read.Chat` and `ChannelMessage.Read.Group` permissions. The conversation owner grants access only for that conversation or team; the adapter does not need tenant-wide chat access.

To register a development instance, follow Microsoft's current Teams SDK workflow:

1. install `@microsoft/teams.cli`, run `teams login`, and confirm custom-app sideloading is enabled;
2. expose port `3978` through an HTTPS Microsoft dev tunnel;
3. register `<tunnel-url>/api/messages` as the messaging endpoint;
4. provide the generated Teams app identity to the runtime through the CLI-created local environment file;
5. replace the IDs and public URLs in `manifest.template.json`, add the two required icons, package it, and install it into the meeting chat;
6. start the companion and then `npm run teams:agent:dev`.

Replace every placeholder ID and URL in `manifest.template.json`, add the required Teams icons, and package the three files as a Teams custom app. A newly installed or reinstalled app can receive chat messages without an `@mention` when RSC consent is granted.

For each incoming message activity:

1. convert the visible message body to plain text;
2. map the conversation ID to `meetingId` and activity ID to `messageId`;
3. call the companion's `POST /api/chat/messages` endpoint using the canonical contract;
4. send every returned `outboundMessages` item through the Teams conversation;
5. never forward the adapter's own outgoing activity back as a human message.

For natural spoken follow-ups in a multi-participant meeting, the companion also needs speaker-attributed finalized captions. A Teams caption or transcript bridge sends them to `POST /api/transcript/segments` using the [transcript adapter contract](../../docs/transcript-adapter-contract.md). The BlackHole audio listener remains a useful fallback for complete meeting memory, but mixed device audio has no reliable participant identity and therefore accepts only explicit `Mary, ...` invocations.

During local development, the Teams messaging endpoint and the companion relay must be reachable through an authenticated HTTPS development tunnel. In production, place the adapter in a small public service and connect it to the local companion through an authenticated outbound WebSocket or message relay. Do not expose port 4310 directly.

Microsoft documentation:

- [Create an agent with the current Teams SDK](https://learn.microsoft.com/en-us/microsoftteams/platform/agents-in-teams/quickstart-create-agent-teams-sdk)
- [Enable agents to receive all chat messages](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/channel-messages-for-bots-and-agents)
- [Microsoft Teams app permissions and consent](https://learn.microsoft.com/en-us/microsoftteams/app-permissions)
- [Build extensible conversations for meeting chat](https://learn.microsoft.com/en-us/microsoftteams/platform/apps-in-teams-meetings/build-extensible-conversation-for-meeting-chat)
