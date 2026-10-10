import type { Entry } from "@/world/history";

/** Every event in the app, with what it carries. Names are "noun:verb". */
export interface Events {
  /** objects changed (any of them); render and panels refresh */
  "world:changed": { ids?: string[] };
  /** an object is being dragged: only its transform moved, no history yet */
  "world:dragging": { ids: string[] };
  "selection:changed": undefined;
  "mode:changed": undefined;
  "settings:changed": undefined;
  /** Alt / Ctrl / Shift went down or up (Ctrl turns Move into Rotate, the status line says so) */
  "modifiers:changed": undefined;
  "history:changed": { entry: Entry | null };
  /** a tool with parameters just ran; the "adjust" panel shows it */
  "tool:ran": { entry: Entry };
  "tool:rerun": undefined;
  "window:toggled": { id: string; open: boolean };
  "room:joined": undefined;
  "room:left": undefined;
  "room:changed": undefined;
  "chat:message": undefined;
  "scripts:errors": undefined;
  "build:allowed": { allowed: boolean };
  "identity:changed": undefined;

  /* requests between features (features never import each other) */
  /** run a tool by id: live tools start in the viewport, the rest run at once */
  "tool:use": { id: string; params?: Record<string, number> };
  /** open the pie menu at a screen point */
  "pie:open": { x: number; y: number };
  /** open the quick tool search, optionally at a screen point */
  "search:open": { x?: number; y?: number };
  /** put the cursor in the chat box */
  "chat:focus": undefined;
  /** open the Build window on an object's script */
  "script:open": { id: string };
  /** a moving body struck an object: scripts hear `on bump`, the sound plays a knock */
  "object:bumped": { id: string; by: string; speed: number };
  /** a script pushes its object (if it is a body): velocity added, m/s */
  "physics:push": { id: string; vel: [number, number, number] };
  /** the user touched a scripted object (clicked it with the Build window closed) */
  "object:touched": { id: string };
  /** your avatar plays a gesture */
  "gesture:play": { name: string };
  /** your avatar sat, stood, started or stopped flying */
  "avatar:changed": undefined;
  /** an object's script played a note (heard by everyone in the room) */
  "sound:play": { id: string; note: number; instrument: string };
  /** a trampoline threw your avatar up */
  "avatar:bounced": undefined;
  /** time of day picked from the menu */
  "sky:set": { mode: "day" | "sunset" | "night" | "cycle" };
  /** a menu command that belongs to some feature ("new", "open", "save", "export", "report"…) */
  "menu:command": { command: string };
}

type Listener<K extends keyof Events> = (payload: Events[K]) => void;

/** typed publish/subscribe; everything that crosses a layer boundary goes through here */
export class Bus {
  private readonly listeners = new Map<keyof Events, Set<Listener<keyof Events>>>();

  on<K extends keyof Events>(event: K, listener: Listener<K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<keyof Events>);
    return () => set.delete(listener as Listener<keyof Events>);
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K] extends undefined ? [] : [Events[K]]): void {
    const payload = args[0] as Events[K];
    for (const listener of this.listeners.get(event) ?? []) listener(payload);
  }
}
