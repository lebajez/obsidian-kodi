import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import KodiBridgePlugin from "./main";
import { KodiApi } from "./api";

export class KodiSettingTab extends PluginSettingTab {
  plugin: KodiBridgePlugin;
  constructor(app: App, plugin: KodiBridgePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;

    new Setting(containerEl).setName("Server URL").setDesc("Base URL of the Kodi JSON-RPC endpoint.").addText((text) =>
      text.setPlaceholder("http://192.168.1.19:8080/jsonrpc").setValue(s.serverUrl).onChange(async (value) => {
        s.serverUrl = value.trim();
        await this.plugin.saveSettings();
      })
    );

    new Setting(containerEl).setName("Authentication").setDesc("Credentials are stored in plugin data in plaintext.").setHeading();
    new Setting(containerEl).setName("Username").addText((text) =>
      text.setValue(s.username).onChange(async (value) => { s.username = value; await this.plugin.saveSettings(); })
    );
    new Setting(containerEl).setName("Password").addText((text) => {
      text.inputEl.type = "password";
      text.setValue(s.password).onChange(async (value) => { s.password = value; await this.plugin.saveSettings(); });
    });

    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText("Test connection").onClick(async () => {
        const api = new KodiApi(s);
        const ok = await api.ping();
        new Notice(ok ? "Kodi Bridge: connection OK." : "Kodi Bridge: connection failed.");
      })
    );

    new Setting(containerEl).setName("Vault folders").setHeading();
    const folders: [string, keyof typeof s][] = [
      ["Movie folder", "movieFolder"],
      ["Music (songs) folder", "musicFolder"],
      ["Album folder", "albumFolder"],
      ["TV folder", "tvFolder"],
      ["Cover folder", "coverFolder"],
    ];
    for (const [label, key] of folders) {
      new Setting(containerEl).setName(label).addText((text) =>
        text.setValue(String(s[key])).onChange(async (value) => {
          (s as any)[key] = value.trim().replace(/\/$/, "");
          await this.plugin.saveSettings();
        })
      );
    }

    new Setting(containerEl).setName("Download covers").setDesc("Download poster images when importing.").addToggle((t) =>
      t.setValue(s.downloadCovers).onChange(async (value) => { s.downloadCovers = value; await this.plugin.saveSettings(); })
    );

    new Setting(containerEl).setName("Note filename").setDesc("How new notes are named.").addDropdown((d) =>
      d.addOption("title", "Title").addOption("title-year", "Title (year)").setValue(s.filenameFormat).onChange(async (value) => {
        s.filenameFormat = value as any;
        await this.plugin.saveSettings();
      })
    );
  }
}
