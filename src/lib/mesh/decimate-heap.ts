/** A binary min-heap keyed by `cost`. */
export class MinHeap<T extends { cost: number }> {
  private readonly items: T[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: T): void {
    const h = this.items;
    let i = h.push(item) - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (h[parent].cost <= item.cost) break;
      h[i] = h[parent];
      i = parent;
    }
    h[i] = item;
  }

  pop(): T | undefined {
    const h = this.items;
    const top = h[0];
    const last = h.pop();
    if (!h.length || last === undefined) return top;
    let i = 0;
    for (;;) {
      let k = 2 * i + 1;
      if (k >= h.length) break;
      if (k + 1 < h.length && h[k + 1].cost < h[k].cost) k++;
      if (h[k].cost >= last.cost) break;
      h[i] = h[k];
      i = k;
    }
    h[i] = last;
    return top;
  }
}
