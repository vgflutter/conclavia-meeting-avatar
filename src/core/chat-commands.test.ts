import assert from "node:assert/strict";
import test from "node:test";

import { defaultChatCommandAliases } from "../config/avatar-config.js";
import { chatResponseChannel, matchChatCommand } from "./chat-commands.js";

await test("matches configurable commands only when the avatar is addressed first", () => {
  assert.deepEqual(
    matchChatCommand("Mary, alza la mano", "Mary", defaultChatCommandAliases),
    { kind: "raise-hand", alias: "alza la mano", argument: "" },
  );
  assert.equal(
    matchChatCommand("Secondo me Mary dovrebbe alzare la mano", "Mary", defaultChatCommandAliases),
    null,
  );
});

await test("preserves the free-form directive after a command alias", () => {
  assert.deepEqual(
    matchChatCommand(
      "@Mary intervieni riportando la discussione sul budget",
      "Mary",
      defaultChatCommandAliases,
    ),
    {
      kind: "speak",
      alias: "intervieni",
      argument: "riportando la discussione sul budget",
    },
  );
});

await test("supports multilingual aliases and a configurable avatar name", () => {
  assert.equal(
    matchChatCommand("Aera, summarize in chat", "Aera", defaultChatCommandAliases)?.kind,
    "summarize-in-chat",
  );
  assert.equal(
    matchChatCommand("Mary, lower your hand", "Mary", defaultChatCommandAliases)?.kind,
    "lower-hand",
  );
  assert.equal(
    matchChatCommand("Mary, applaudi", "Mary", defaultChatCommandAliases)?.kind,
    "applaud",
  );
});

await test("keeps ordinary chat questions silent unless voice is explicit", () => {
  assert.equal(chatResponseChannel("@Mary, cosa ne pensi?", "Mary", null, false), "chat");
  assert.equal(
    chatResponseChannel(
      "Mary, intervieni sul budget",
      "Mary",
      { kind: "speak", alias: "intervieni", argument: "sul budget" },
      false,
    ),
    "voice",
  );
  assert.equal(chatResponseChannel("Mary, vai pure", "Mary", null, true), "voice");
  assert.equal(chatResponseChannel("Mary, vai pure", "Mary", null, false), "chat");
});
