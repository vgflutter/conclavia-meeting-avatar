# Microsoft Teams chat adapter

Use a Teams agent installed in the meeting group chat. The template manifest declares the `groupchat` bot scope and the resource-specific `ChatMessage.Read.Chat` application permission. The conversation owner grants access for that conversation when installing the app; the adapter does not need tenant-wide chat access.

Replace every placeholder ID and URL in `manifest.template.json`, add the required Teams icons, and package the three files as a Teams custom app. A newly installed or reinstalled app can receive chat messages without an `@mention` when RSC consent is granted.

For each incoming message activity:

1. convert the visible message body to plain text;
2. map the conversation ID to `meetingId` and activity ID to `messageId`;
3. call the companion's `POST /api/chat/messages` endpoint using the canonical contract;
4. send every returned `outboundMessages` item through the Teams conversation;
5. never forward the adapter's own outgoing activity back as a human message.

During local development, the Teams messaging endpoint and the companion relay must be reachable through an authenticated HTTPS development tunnel. In production, place the adapter in a small public service and connect it to the local companion through an authenticated outbound WebSocket or message relay. Do not expose port 4310 directly.

Microsoft documentation:

- [Enable agents to receive all chat messages](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/channel-messages-for-bots-and-agents)
- [Build extensible conversations for meeting chat](https://learn.microsoft.com/en-us/microsoftteams/platform/apps-in-teams-meetings/build-extensible-conversation-for-meeting-chat)
