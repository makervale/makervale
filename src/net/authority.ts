/**
 * Scripts run on one computer per room, the "authority", and it alone judges the laws of space. It must be a peer
 * that has the room's scene (synced), and every peer must pick the same one without talking about it, from what
 * all of them know: who is synced, and the signed rules.
 * - The owner, whenever they are here: the one person everyone can recognise without asking anyone (the rules are
 *   signed with their key), and who can remove anyone abusing the room. People coming and going never move it.
 * - Otherwise the synced peer with the smallest id among those who may build. Peer ids are chosen by each browser,
 *   so this one is only trusted as far as building goes (verdict.ts, objects.ts): nothing it does as the authority
 *   is more than it could do by building. Someone who may not build is never it while a builder is here.
 */
export interface Member {
  id: string;
  synced: boolean;
}

/** the owner if synced here, else the synced builder with the smallest id, else any synced member; yourself when
 * nobody (not even you) is synced */
export function pickAuthority(
  selfId: string,
  selfSynced: boolean,
  peers: Iterable<Member>,
  mayBuild: (id: string) => boolean = () => true,
  owner = "",
): string {
  const ids = [...peers].filter((p) => p.synced).map((p) => p.id);
  if (selfSynced) ids.push(selfId);
  if (owner && ids.includes(owner)) return owner;
  ids.sort();
  return ids.find(mayBuild) ?? ids[0] ?? selfId;
}
