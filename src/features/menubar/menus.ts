/** Menu bar behaviour: click a title to open its menu, slide across titles while one is open, click away to close. */

export function wireMenus(bar: HTMLElement, run: (command: string) => void): void {
  const close = () => bar.querySelectorAll(".m.open").forEach((m) => m.classList.remove("open"));
  bar.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const title = target.closest(".m > button");
    if (title) {
      const m = title.parentElement!;
      const wasOpen = m.classList.contains("open");
      close();
      if (!wasOpen) m.classList.add("open");
      return;
    }
    const item = target.closest<HTMLButtonElement>(".menu button");
    if (!item) return;
    close();
    if (!item.disabled) run(item.dataset.cmd!);
  });
  bar.addEventListener("pointerover", (e) => {
    const title = (e.target as HTMLElement).closest(".m > button");
    if (!title || !bar.querySelector(".m.open") || title.parentElement!.classList.contains("open")) return;
    close();
    title.parentElement!.classList.add("open");
  });
  document.addEventListener("pointerdown", (e) => {
    if (!(e.target as HTMLElement).closest("#menubar")) close();
  });
}
