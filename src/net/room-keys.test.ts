import { describe, expect, it } from "vitest";
import {
  CODE_LENGTH,
  CODE_LETTERS,
  canonicalCode,
  displayCode,
  inviteLink,
  invitedCode,
  newRoomCode,
} from "./room-code";
import { roomKeys } from "./room-keys";
import { fromBase64, pack, seal, toBase64, unpack, unseal } from "./seal";

describe("room codes", () => {
  it("makes twelve letters from the readable alphabet, shown in groups of four", () => {
    const code = newRoomCode();
    expect(code).toHaveLength(CODE_LENGTH);
    expect([...code].every((c) => CODE_LETTERS.includes(c))).toBe(true);
    expect(displayCode("abcdefghjkmn")).toBe("abcd-efgh-jkmn");
    expect(displayCode("abc234xyz")).toBe("abc234xyz");
  });

  it("reads typed codes, grouped codes and whole invite links", () => {
    expect(canonicalCode("ABCD-efgh jkmn")).toBe("abcdefghjkmn");
    expect(canonicalCode("abc234xyz")).toBe("abc234xyz");
    expect(canonicalCode("https://x.io/app/#room=abcd-efgh-jkmn")).toBe("abcdefghjkmn");
    expect(canonicalCode("no")).toBeNull();
    expect(canonicalCode("<script>")).toBeNull();
    const link = inviteLink("abcdefghjkmn", "https://x.io/app/?a=1#old");
    expect(link).toBe("https://x.io/app/?a=1#room=abcd-efgh-jkmn");
    expect(invitedCode("#room=abcd-efgh-jkmn")).toBe("abcdefghjkmn");
    expect(invitedCode("#other=1")).toBeNull();
  });
});

describe("room keys and seals", () => {
  it("derives the same keys from the same code, different ones from another", async () => {
    const a = await roomKeys("abcdefghjkmn");
    const b = await roomKeys("abcdefghjkmp");
    expect(a.topic).toMatch(/^[0-9a-f]{64}$/);
    expect(a.pubkey).toMatch(/^[0-9a-f]{64}$/);
    expect(new Set([a.topic, a.password, a.channel, a.pubkey]).size).toBe(4);
    expect(b.topic).not.toBe(a.topic);
    expect(await roomKeys("abcdefghjkmn")).toBe(a);
  });

  it("seals for the room only, deterministically when asked", async () => {
    const a = await roomKeys("abcdefghjkmn");
    const b = await roomKeys("abcdefghjkmp");
    const bytes = pack({ hello: "room", n: [1, 2, 3] });
    const sealed = await seal(a, bytes);
    expect(unpack((await unseal(a, sealed))!)).toEqual({ hello: "room", n: [1, 2, 3] });
    expect(await unseal(b, sealed)).toBeNull();
    sealed[20] ^= 1;
    expect(await unseal(a, sealed)).toBeNull();
    const d1 = toBase64(await seal(a, bytes, true));
    const d2 = toBase64(await seal(a, bytes, true));
    expect(d1).toBe(d2);
    expect(toBase64(await seal(a, bytes))).not.toBe(toBase64(await seal(a, bytes)));
    expect(fromBase64(d1)).toEqual(await seal(a, bytes, true));
  });

  it("refuses to unpack past the limit", () => {
    const big = pack("x".repeat(100_000));
    expect(unpack(big, 1000)).toBeNull();
    expect(unpack(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
