/** Is this a phone? Phones get a limited preview: no building, no tool windows (see features/phone-mode). */

/** a touch screen that is narrow, or short (a phone on its side); tablets keep the full app */
export const PHONE_QUERY = "(pointer: coarse) and (max-width: 900px), (pointer: coarse) and (max-height: 500px)";

export const DESKTOP_ONLY_MESSAGE =
  "That needs a computer for now. Here you can walk, chat, join rooms and tap things.";

export const isPhone = (): boolean => typeof matchMedia === "function" && matchMedia(PHONE_QUERY).matches;
