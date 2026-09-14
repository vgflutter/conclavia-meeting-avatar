import { expect, test } from "@playwright/test";
import { meetingPermissionDecision, parseMeetingVoiceCommand } from "../../src/lib/meeting-command";
import { resolveLocalMeetingSpeakingTurn, type SpeakingTurnInput } from "../../src/lib/meeting-speaking-turn";

const pending = { id: "prepared", statement: "Tre per tre fa 13.", response: "Sì, 3 per 3 fa 9, non 13." };
function input(text: string, extra: Partial<SpeakingTurnInput> = {}): SpeakingTurnInput {
  return { text, wakeWord: "Riccardo", pending, recent: [], ...extra };
}

for (const text of ["Sì, Riccardo.", "Yes, Riccardo.", "Riccardo, sì.", "Ok, Riccardo.",
  "Sì, Riccardo, dimmi.", "Vai Riccardo", "Prego Riccardo", "Sentiamo Riccardo",
  "Temperatura? Non si può. Sì, Riccardo, dimmi."]) {
  test(`contextual floor: ${text}`, () => {
    expect(resolveLocalMeetingSpeakingTurn(input(text))).toMatchObject({ action: "grant", reason: "named_grant" });
  });
}

for (const text of ["Sì, Riccardo.", "Yes, Riccardo.", "Riccardo, sì.", "Ok, Riccardo."]) {
  test(`bare acknowledgement needs an actual pending turn: ${text}`, () => {
    expect(resolveLocalMeetingSpeakingTurn(input(text, { pending: undefined })))
      .toMatchObject({ action: "ignore", reason: "no_pending_turn" });
    expect(meetingPermissionDecision(text, "Riccardo")).toBeUndefined();
  });
}

test("names, mentions, quotes and ambiguity cannot release a raised hand", () => {
  for (const text of ["Sì", "Vai pure", "Sì, Marco", 'Ha detto: "Sì, Riccardo"', "Ne parlavo ieri con Riccardo"]) {
    expect(resolveLocalMeetingSpeakingTurn(input(text)).action, text).toBe("ignore");
  }
  expect(resolveLocalMeetingSpeakingTurn(input("Sì, Riccardo", { blocked: true })))
    .toMatchObject({ action: "ignore", reason: "ambiguous_recipient" });
  expect(resolveLocalMeetingSpeakingTurn(input("Sì, Anna Maria", { wakeWord: "Anna Maria" })).action).toBe("grant");
});

test("negative/deferred invitations and new questions are not pending-turn grants", () => {
  for (const text of ["Aspetta Riccardo", "Riccardo, non ora", "Riccardo, go ahead but do not speak", "Riccardo, vai ma non ora", "Riccardo, sì ma aspetta"]) {
    expect(resolveLocalMeetingSpeakingTurn(input(text)).action, text).toBe("decline");
  }
  expect(resolveLocalMeetingSpeakingTurn(input("Riccardo, dimmi solo quando ti chiamo")).action).toBe("defer");
  expect(resolveLocalMeetingSpeakingTurn(input("Riccardo, vai quando te lo dico")).action).toBe("defer");
  expect(resolveLocalMeetingSpeakingTurn(input("Riccardo, dimmi qual è il budget")))
    .toMatchObject({ action: "request", command: { kind: "ask", prompt: "qual è il budget" } });
  expect(resolveLocalMeetingSpeakingTurn(input("Riccardo, cosa volevi dire?"))).toMatchObject({ action: "unresolved" });
});

for (const text of [
  "Riccardo ci sta ascoltando.", "Riccardo ci sta ascoltando?",
  "Riprenderò la mia vita in mano. Riccardo ci sta ascoltando.",
  "Riccardo sta preparando la scaletta.", "Riccardo viene domani.",
  "Riccardo is listening to us.", "Riccardo is listening to us?",
  "We can continue. Riccardo has the agenda.",
]) {
  test(`a name is not permission: ${text}`, () => {
    expect(parseMeetingVoiceCommand(text, "Riccardo")).toBeUndefined();
    for (const pendingTurn of [pending, undefined]) {
      expect(resolveLocalMeetingSpeakingTurn(input(text, { pending: pendingTurn })).action)
        .toBe("unresolved");
    }
  });
}

for (const text of [
  "Riccardo, ci stai ascoltando?", "Riccardo, mi senti?", "Riccardo, raccontami una barzelletta.",
  "Riccardo, dove è nata Conclavia?", "Riccardo, qual è il budget?",
  "Riccardo, ricordami il budget.", "Riccardo, are you listening?",
  "Riccardo, tell me a joke.", "Riccardo, what is the budget?",
]) {
  test(`clear direct requests still work: ${text}`, () => {
    expect(resolveLocalMeetingSpeakingTurn(input(text))).toMatchObject({ action: "request" });
  });
}
