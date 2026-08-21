# Google Meet chat adapter

Google Meet does not currently expose live in-meeting chat messages through the Meet REST API. That API exposes meeting spaces, conferences, participants, recordings, and transcripts. Live chat ingestion therefore requires an isolated browser bridge.

The proposed bridge is a browser extension with host access limited to `https://meet.google.com/*`. It observes the open chat panel, converts each newly rendered human message into the canonical `POST /api/chat/messages` payload, and posts returned `outboundMessages` through the same chat panel.

DOM extraction and message posting must remain inside this adapter because Meet's rendered markup is not a stable public API. The command router, meeting memory, LLM, voice, gestures, and configuration must never depend on Meet selectors.

The bridge should include:

- an explicit per-meeting enable switch;
- a visible connected/disconnected indicator;
- stable local deduplication before forwarding;
- a preview of the detected author and text before first activation;
- configurable selectors or versioned extraction strategies;
- a hard stop when the chat panel cannot be identified confidently;
- loop prevention for messages it posts on behalf of the avatar.

Until the browser bridge is calibrated against the current Meet UI, use the management console's **Chat multipiattaforma** panel with origin `Google Meet`. It exercises the exact production command and response contract without pretending that an unsupported Google API exists.

Google documentation:

- [Google Meet REST API overview](https://developers.google.com/workspace/meet/api/guides/overview)
