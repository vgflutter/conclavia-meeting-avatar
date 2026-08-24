# Google Meet chat adapter

Google Meet does not currently expose live in-meeting chat messages through the Meet REST API. That API exposes meeting spaces, conferences, participants, recordings, and transcripts. Live chat ingestion therefore requires an isolated browser bridge.

The included Manifest V3 Chrome extension has page access limited to `https://meet.google.com/*` and network access limited to the loopback companion at `http://127.0.0.1:4310/*`. It observes the open chat panel, converts each newly rendered human message into the canonical `POST /api/chat/messages` payload, and posts returned `outboundMessages` through the same chat panel. Cross-origin requests run in the extension service worker rather than the content script.

DOM extraction and message posting must remain inside this adapter because Meet's rendered markup is not a stable public API. The command router, meeting memory, LLM, voice, gestures, and configuration must never depend on Meet selectors.

## Install in Chrome

1. Start the local companion on port `4310`.
2. Run `npm run meet:bridge:open`.
3. Enable **Developer mode** in `chrome://extensions`.
4. Select **Load unpacked** and choose `adapters/google-meet/extension`.
5. Reload the active Meet tab and keep the in-call chat panel open.
6. Send a new message such as `Mary, alza la mano`.

The action badge shows `ON` when the bridge sees the open chat, `OPEN` when the panel is closed, `OFF` when ingestion is paused, and `ERR` when the local companion is unavailable. Clicking the extension action toggles ingestion for the current Meet tab. Existing messages are baselined on connection and are not replayed, so commands must be sent after the badge turns `ON`. The bridge deduplicates messages locally and in the companion and suppresses avatar-authored echoes.

The extraction strategy first uses Meet's current message classes and then a constrained accessibility-tree fallback. It stops when it cannot confidently identify the chat composer. Meet's DOM is not a public API, so selector updates remain isolated in `extension/meet-dom.js`.

Visible captions still use the separate [transcript adapter contract](../../docs/transcript-adapter-contract.md). Until the attributed-caption extractor is packaged, meeting audio remains the production speech input.

Google documentation:

- [Google Meet REST API overview](https://developers.google.com/workspace/meet/api/guides/overview)
- [Chrome extension cross-origin requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
