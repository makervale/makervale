/** URL parameters that tweak networking (`?relays=`, `?pool=`, `?ice=none`, `?debug=net`); null outside a page */
export function queryParam(name: string): string | null {
  try {
    return new URLSearchParams(location.search).get(name);
  } catch {
    return null;
  }
}

/** a comma-separated list parameter, or null when absent or empty */
export function queryList(name: string): string[] | null {
  const raw = queryParam(name);
  if (!raw) return null;
  const list = raw.split(",").filter(Boolean);
  return list.length ? list : null;
}

/** `?debug=net` logs room traffic to the console */
const DEBUG = queryParam("debug") === "net";

export function netDebug(...parts: unknown[]): void {
  if (DEBUG) console.debug("[net]", ...parts);
}
