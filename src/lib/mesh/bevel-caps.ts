/** The holes a bevel leaves at its vertices, found and closed. */

export interface Cap {
  loop: number[];
  /** the beveled vertex the cap replaces */
  owner: number;
}

/** per owner: the edges between its new points that no polygon runs backwards, as end → start */
function looseEdges(polys: number[][], owner: number[]): Map<number, Map<number, number>> {
  const directed = new Set<string>();
  for (const p of polys) p.forEach((a, k) => directed.add(`${a}>${p[(k + 1) % p.length]}`));
  const loose = new Map<number, Map<number, number>>();
  for (const d of directed) {
    const [a, b] = d.split(">").map(Number);
    const o = owner[a];
    if (o < 0 || owner[b] !== o || directed.has(`${b}>${a}`)) continue;
    if (!loose.has(o)) loose.set(o, new Map());
    loose.get(o)!.set(b, a);
  }
  return loose;
}

function cyclesOf(next: Map<number, number>): number[][] {
  const seen = new Set<number>();
  const out: number[][] = [];
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const cycle: number[] = [];
    let x: number | undefined = start;
    while (x !== undefined && !seen.has(x)) {
      seen.add(x);
      cycle.push(x);
      x = next.get(x);
    }
    if (x === start && cycle.length >= 3) out.push(cycle);
  }
  return out;
}

/** loops of loose edges around each beveled vertex: each closes one hole, wound to match its neighbours */
export function findCaps(polys: number[][], owner: number[]): Cap[] {
  const caps: Cap[] = [];
  for (const [v, next] of looseEdges(polys, owner)) for (const loop of cyclesOf(next)) caps.push({ loop, owner: v });
  return caps;
}
