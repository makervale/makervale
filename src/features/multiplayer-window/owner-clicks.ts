/** The owner's clicks in a room: kind, lockdown, who builds, removing people, seeing and undoing their changes. */
import { toast } from "@/ui/toast";
import type { MpWindow } from "./state";

function confirmPublic(win: MpWindow): void {
  const text =
    "Make this room public for good? Its code goes on the Public list: anyone can join while you're in it and see your IP address. It can't become private again.";
  toast(text, { label: "Make public", run: () => void win.deps.session.makePublic(), holdMs: 10_000 });
}

function kick(win: MpWindow, id: string, name: string): void {
  toast(`Remove ${name} from this room? They can't come back in.`, {
    label: "Remove",
    run: () => void win.deps.session.kick(id),
  });
}

function undo(win: MpWindow, who: string, name: string): void {
  const n = win.deps.session.undoPerson(who);
  toast(
    n
      ? `Undid ${name}'s changes (${n} objects). Ctrl+Z brings them back.`
      : `Nothing of ${name}'s to undo: others changed it since.`,
  );
}

function show(win: MpWindow, who: string, name: string): void {
  const s = win.deps.session;
  const wasShown = s.showingChanges(who);
  const n = s.toggleChanges(who);
  if (!wasShown && !n) toast(`Nothing of ${name}'s is left in the scene`);
  win.render();
}

function rewind(win: MpWindow, minutes: number): void {
  const n = win.deps.session.rewind(minutes);
  toast(n ? `The room is back to ${minutes} min ago. Ctrl+Z undoes that.` : "Nothing changed since then.");
}

/** true if the click was one of these */
export function ownerClick(win: MpWindow, t: HTMLElement): boolean {
  const s = win.deps.session;
  const pick = (attr: string) => t.closest<HTMLElement>(`[${attr}]`);
  const [kind, let_, kickBtn, undoBtn, rewindBtn, showBtn] = [
    pick("data-kind"),
    pick("data-let"),
    pick("data-kick"),
    pick("data-undo"),
    pick("data-rewind"),
    pick("data-show"),
  ];
  if (kind) confirmPublic(win);
  else if (t.closest("#mp-lockdown")) void s.lockdown().then(() => toast("Lockdown: only you build now."));
  else if (let_) void s.letBuild(let_.dataset.let!, !!let_.dataset.yes);
  else if (kickBtn) kick(win, kickBtn.dataset.kick!, kickBtn.dataset.name ?? "them");
  else if (undoBtn) undo(win, undoBtn.dataset.undo!, undoBtn.dataset.name ?? "their");
  else if (rewindBtn) rewind(win, +rewindBtn.dataset.rewind!);
  else if (showBtn) show(win, showBtn.dataset.show!, showBtn.dataset.name ?? "them");
  else return false;
  return true;
}
