import { App, Modal } from "obsidian";

export interface PickItem { id: number; title: string; subtitle?: string; }

export class KodiImportModal extends Modal {
  private items: PickItem[];
  private onConfirm: (ids: number[]) => void;
  private selected = new Set<number>();
  private filtered: PickItem[] = [];
  private listEl!: HTMLElement;
  private countEl!: HTMLElement;
  private importBtn!: HTMLButtonElement;

  constructor(app: App, items: PickItem[], onConfirm: (ids: number[]) => void) {
    super(app);
    this.items = items;
    this.onConfirm = onConfirm;
    this.filtered = [...items];
  }

  onOpen(): void {
    this.modalEl.addClass("kodi-import-modal");
    const { contentEl } = this;
    contentEl.empty();
    const searchRow = contentEl.createDiv({ cls: "kodi-search-row" });
    const searchInput = searchRow.createEl("input", { cls: "kodi-search-input", attr: { type: "text", placeholder: "Search…" } });
    const selectAllBtn = searchRow.createEl("button", { text: "Select all" });
    selectAllBtn.addEventListener("click", () => {
      const allSelected = this.filtered.every((b) => this.selected.has(b.id));
      if (allSelected) this.filtered.forEach((b) => this.selected.delete(b.id));
      else this.filtered.forEach((b) => this.selected.add(b.id));
      selectAllBtn.textContent = allSelected ? "Select all" : "Deselect all";
      this.renderList();
      this.updateCount();
    });
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.toLowerCase();
      this.filtered = q
        ? this.items.filter((b) => b.title.toLowerCase().includes(q) || (b.subtitle ?? "").toLowerCase().includes(q))
        : [...this.items];
      this.renderList();
    });
    this.listEl = contentEl.createDiv({ cls: "kodi-item-list" });
    this.renderList();
    const footer = contentEl.createDiv({ cls: "kodi-footer" });
    this.countEl = footer.createSpan({ cls: "kodi-footer-count" });
    const btnRow = footer.createDiv({ attr: { style: "display:flex;gap:8px" } });
    const cancelBtn = btnRow.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());
    this.importBtn = btnRow.createEl("button", { text: "Import", cls: "mod-cta" }) as HTMLButtonElement;
    this.importBtn.addEventListener("click", () => {
      this.onConfirm(Array.from(this.selected));
      this.close();
    });
    this.updateCount();
  }

  private renderList(): void {
    this.listEl.empty();
    for (const item of this.filtered) {
      const row = this.listEl.createDiv({ cls: "kodi-item" });
      const checkbox = row.createEl("input", { attr: { type: "checkbox", id: `cb-${item.id}` } }) as HTMLInputElement;
      checkbox.checked = this.selected.has(item.id);
      row.createEl("label", { text: item.subtitle ? `${item.title} — ${item.subtitle}` : item.title, attr: { for: `cb-${item.id}` } });
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) this.selected.add(item.id);
        else this.selected.delete(item.id);
        this.updateCount();
      });
      row.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).tagName !== "INPUT") {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event("change"));
        }
      });
    }
  }

  private updateCount(): void {
    const n = this.selected.size;
    this.countEl.textContent = `${n} of ${this.items.length} selected`;
    this.importBtn.textContent = n > 0 ? `Import ${n}` : "Import";
    this.importBtn.disabled = n === 0;
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
