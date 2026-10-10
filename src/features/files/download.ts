/** Hand a file to the person: through the host's save prompt when the page runs inside one, else a download. */
import { toast } from "@/ui/toast";

interface Downloads {
  save(file: { filename: string; data: Blob | string }): Promise<void>;
}

/** what the Claude artifact host puts on `window` */
interface Host {
  use(capability: "downloads"): Promise<Downloads | null | undefined>;
}

const REVOKE_AFTER_MS = 4000;

function host(): Host | undefined {
  const claude = (window as unknown as { claude?: Partial<Host> }).claude;
  return claude?.use ? (claude as Host) : undefined;
}

function viaLink(filename: string, data: Blob | string): void {
  const blob = data instanceof Blob ? data : new Blob([data]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), REVOKE_AFTER_MS);
}

const declined = (e: unknown): boolean => (e as { code?: string } | null)?.code === "declined";

export async function offerFile(filename: string, data: Blob | string): Promise<void> {
  try {
    const h = host();
    if (!h) {
      viaLink(filename, data);
      return;
    }
    const downloads = await h.use("downloads");
    if (!downloads) {
      toast("Saving files does not work in this view");
      return;
    }
    await downloads.save({ filename, data });
    toast("Saved " + filename);
  } catch (e) {
    toast(declined(e) ? "Save cancelled" : "Could not save the file");
  }
}
