/** What the Tools panel shows: filter, query, the tool on the card, wide or narrow, hidden; remembered per browser. */
export type Filter = "all" | "fit" | "pinned" | "recent";

export interface PanelState {
  filter: Filter;
  query: string;
  /** the tool shown on the card */
  id: string;
  /** descriptions docked next to the list */
  wide: boolean;
  /** the whole panel put away */
  hidden: boolean;
  collapsed: Set<string>;
  /** phone layout: the panel slides over the view */
  mobileOpen: boolean;
}

const WIDE_KEY = "pias.cat.wide";
const HIDDEN_KEY = "pias.cat.hidden";
const COLLAPSED_KEY = "pias.cat.collapsed";

export function loadState(): PanelState {
  const st: PanelState = {
    filter: "all",
    query: "",
    id: "extrude",
    wide: false,
    hidden: false,
    collapsed: new Set(),
    mobileOpen: false,
  };
  try {
    st.wide = localStorage.getItem(WIDE_KEY) === "1";
    st.hidden = localStorage.getItem(HIDDEN_KEY) === "1";
    st.collapsed = new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) || "[]") as string[]);
  } catch {
    /* fine: defaults */
  }
  return st;
}

export function saveState(st: PanelState): void {
  try {
    localStorage.setItem(WIDE_KEY, st.wide ? "1" : "0");
    localStorage.setItem(HIDDEN_KEY, st.hidden ? "1" : "0");
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...st.collapsed]));
  } catch {
    /* storage unavailable */
  }
}
