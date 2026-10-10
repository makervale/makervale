/**
 * Scripts run on one computer per room, the "authority". It must be a peer that has the room's scene (synced), and
 * every peer must pick the same one without talking about it: the synced peer with the smallest id. The longest
 * standing peers are the synced ones, so the authority rarely changes while people come and go.
 */
export interface Member {
  id: string;
  synced: boolean;
}

/** the synced member with the smallest id; yourself when nobody (not even you) is synced yet */
export function pickAuthority(selfId: string, selfSynced: boolean, peers: Iterable<Member>): string {
  const ids = [...peers].filter((p) => p.synced).map((p) => p.id);
  if (selfSynced) ids.push(selfId);
  ids.sort();
  return ids[0] ?? selfId;
}
