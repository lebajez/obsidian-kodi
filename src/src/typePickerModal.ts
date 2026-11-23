import { App, Modal } from "obsidian";

export class KodiTypePickerModal extends Modal {
  constructor(app: App, private onSelect: (type: string) => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Choose media type to import from Kodi" });
    const row = contentEl.createDiv({ attr: { style: "display:flex;gap:8px;flex-wrap:wrap;margin-top:8px" } });
    const choices: [string, string][] = [
      ["movie", "Movie"],
      ["series", "TV show"],
      ["album", "Music album"],
      ["song", "Song"],
    ];
    for (const [type, label] of choices) {
      const btn = row.createEl("button", { text: label });
      btn.addEventListener("click", () => {
        this.close();
        this.onSelect(type);
      });
    }
  }
}
