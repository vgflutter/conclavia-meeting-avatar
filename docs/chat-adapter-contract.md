# Chat adapter contract

The companion treats meeting chat as a platform-neutral event stream. A Teams agent, a Google Meet browser bridge, or any other adapter sends the same canonical payload to the local companion.

## Inbound message

`POST http://127.0.0.1:4310/api/chat/messages`

```json
{
  "platform": "teams",
  "meetingId": "19:meeting-thread-id",
  "messageId": "1700000000000",
  "speakerName": "Vincenzo",
  "text": "Mary, riassumi in chat",
  "capturedAt": "2026-08-21T18:00:00.000Z",
  "senderIsAvatar": false
}
```

`platform` is `teams`, `google-meet`, or `generic`. The tuple `platform + meetingId + messageId` is the idempotency key. Replayed messages are ignored. Adapters must convert platform HTML or rich text to plain text before sending it.

Set `senderIsAvatar` for a message previously posted by the adapter on behalf of the avatar. The companion also ignores messages whose speaker name equals the configured avatar name. These two checks prevent response loops.

## Result and outbound messages

The response reports the matched command, the normal meeting turn when one was evaluated, and zero or more messages for the adapter to publish:

```json
{
  "accepted": true,
  "reason": "command",
  "command": {
    "kind": "summarize-in-chat",
    "alias": "riassumi in chat",
    "argument": ""
  },
  "turn": {
    "responseChannel": "chat"
  },
  "outboundMessages": [
    {
      "platform": "teams",
      "meetingId": "19:meeting-thread-id",
      "replyToMessageId": "1700000000000",
      "speakerName": "Mary",
      "text": "The generated summary."
    }
  ]
}
```

The adapter owns platform delivery. It posts each `outboundMessages` item to the source meeting and must identify that outgoing message as avatar-authored if the platform echoes it back.

## Command behavior

Commands are deterministic only when the message starts with the configured avatar name or mention. Aliases are editable in the management web application.

| Command | Default examples | Result |
| --- | --- | --- |
| `raise-hand` | `Mary, alza la mano` | Immediately raises the MetaHuman hand. |
| `lower-hand` | `Mary, abbassa la mano` | Immediately lowers the hand and clears a pending autonomous request. |
| `summarize-in-chat` | `Mary, riassumi in chat` | Uses meeting memory and returns text to the adapter without speaking. |
| `reply-in-chat` | `Mary, rispondi in chat ...` | Answers the free-form directive in chat without speaking. |
| `speak` | `Mary, intervieni ...` | Uses the free-form directive to generate voice, mood, lip-sync, and body performance. |

All other chat messages enter the same chronological memory as speech. An unaddressed message can only cause the existing conservative `request-to-speak` flow; it cannot make the avatar speak autonomously.

## Adapter requirements

An adapter must:

1. produce stable meeting and message identifiers;
2. preserve the author display name and timestamp;
3. strip markup while preserving visible text;
4. forward every human-authored message once;
5. publish returned outbound messages;
6. mark or filter avatar-authored echoes;
7. disclose to participants that meeting content is processed by an AI system.

The companion binds to loopback by default. A cloud-hosted adapter therefore needs an authenticated relay or a development tunnel terminating on the same machine. Do not expose the local endpoint publicly without authentication and TLS.
