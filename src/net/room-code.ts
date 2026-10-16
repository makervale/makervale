/**
 * Room codes: what people read out, type and share. A code is the room's only secret: everything else (where the
 * peers meet, the key that encrypts the room's copy on the relays) is derived from it (room-keys.ts). New codes are
 * twelve letters, shown in groups of four; older nine-letter codes keep working.
 */

/** no 0/o, 1/l/i: codes are read out loud and typed */
export const CODE_LETTERS = "abcdefghjkmnpqrstuvwxyz23456789";
export const CODE_LENGTH = 12;
const GROUP = 4;
/** what any code (new or old, typed or from a public listing) may look like once cleaned */
const CODE = /^[a-z0-9_]{6,40}$/;
/** the fragment of an invite link: never sent to the server that hosts the page */
const LINK_PARAM = "room";

/** a fresh code, every letter uniformly chosen (bytes past the last full alphabet are drawn again) */
export function newRoomCode(): string {
  const n = CODE_LETTERS.length;
  const limit = 256 - (256 % n);
  let out = "";
  while (out.length < CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(CODE_LENGTH))) {
      if (b < limit && out.length < CODE_LENGTH) out += CODE_LETTERS[b % n];
    }
  }
  return out;
}

/** the code inside an invite link (…#room=abcd-efgh-jkmn), or null */
function fromLink(text: string): string | null {
  const at = text.indexOf("#");
  if (at < 0) return null;
  return new URLSearchParams(text.slice(at + 1)).get(LINK_PARAM);
}

/** a typed code, a code with dashes or spaces, or a whole invite link, as the canonical code; null if none */
export function canonicalCode(input: string): string | null {
  const raw = fromLink(input.trim()) ?? input;
  const code = raw.toLowerCase().replace(/[\s-]+/g, "");
  return CODE.test(code) ? code : null;
}

/** twelve-letter codes in groups of four (abcd-efgh-jkmn); older codes as they are */
export function displayCode(code: string): string {
  if (code.length !== CODE_LENGTH) return code;
  const groups: string[] = [];
  for (let i = 0; i < code.length; i += GROUP) groups.push(code.slice(i, i + GROUP));
  return groups.join("-");
}

/** a link that opens this page and offers to join the room */
export function inviteLink(code: string, page: string): string {
  return page.replace(/#.*$/, "") + "#" + LINK_PARAM + "=" + displayCode(code);
}

/** the room an invite link in the address bar points to, if any */
export function invitedCode(hash: string): string | null {
  const code = fromLink(hash.startsWith("#") ? hash : "#" + hash);
  return code ? canonicalCode(code) : null;
}
