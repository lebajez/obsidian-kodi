"use strict";
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => CalibreBridgePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/api.ts
var import_obsidian = require("obsidian");
var CalibreApi = class {
  constructor(s) {
    this.s = s;
  }
  authHeader() {
    if (this.s.username && this.s.password) {
      return {
        Authorization: "Basic " + btoa(`${this.s.username}:${this.s.password}`)
      };
    }
    return {};
  }
  buildUrl(path, params = {}) {
    const url = new URL(path, this.s.serverUrl + "/");
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    return url.toString();
  }
  req(_0) {
    return __async(this, arguments, function* (path, params = {}) {
      const url = this.buildUrl(path, params);
      try {
        const res = yield (0, import_obsidian.requestUrl)({
          url,
          method: "GET",
          headers: this.authHeader()
        });
        return res.json;
      } catch (e) {
        const status = e == null ? void 0 : e.status;
        if (status === 401) {
          new import_obsidian.Notice(
            "Calibre: Unauthorized (401). Fill in username and password in settings."
          );
        } else {
          new import_obsidian.Notice(`Calibre: Request failed \u2014 ${e instanceof Error ? e.message : String(e)}`);
        }
        throw e;
      }
    });
  }
  getLibraryInfo() {
    return __async(this, null, function* () {
      return this.req("/ajax/library-info");
    });
  }
  searchBooks(num = 2e4) {
    return __async(this, null, function* () {
      const data = yield this.req(
        "/ajax/search",
        {
          query: "",
          library_id: this.s.libraryId,
          num: String(num)
        }
      );
      return data.book_ids;
    });
  }
  getBooks(ids) {
    return __async(this, null, function* () {
      const CHUNK = 100;
      const result = {};
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const data = yield this.req("/ajax/books", {
          ids: chunk.join(","),
          library_id: this.s.libraryId
        });
        Object.assign(result, data);
      }
      return result;
    });
  }
  getCover(bookId) {
    return __async(this, null, function* () {
      const url = this.buildUrl(`/get/cover/${bookId}`, {
        library_id: this.s.libraryId
      });
      try {
        const res = yield (0, import_obsidian.requestUrl)({
          url,
          method: "GET",
          headers: this.authHeader()
        });
        return res.arrayBuffer;
      } catch (e) {
        const status = e == null ? void 0 : e.status;
        if (status !== 404) {
          console.error(`Calibre: cover fetch failed for book ${bookId}:`, e);
        }
        return null;
      }
    });
  }
};

// src/annotations.ts
function splitCommentsHtml(html) {
  if (!html || html.trim() === "") return { descriptionHtml: "", annotations: null };
  const doc = new DOMParser().parseFromString(html, "text/html");
  const annotationsDiv = doc.body.querySelector("div.user_annotations");
  if (!annotationsDiv) {
    return { descriptionHtml: html, annotations: null };
  }
  const annotations = parseAnnotationsDiv(annotationsDiv);
  annotationsDiv.remove();
  doc.body.querySelectorAll("hr.annotations_divider").forEach((hr) => hr.remove());
  return { descriptionHtml: doc.body.innerHTML, annotations };
}
function textOf(node) {
  var _a;
  return ((_a = node == null ? void 0 : node.textContent) != null ? _a : "").trim();
}
function extractFields(span) {
  const fields = [];
  const children = Array.from(span.childNodes);
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.nodeType !== Node.ELEMENT_NODE || node.tagName !== "B") continue;
    const label = textOf(node);
    if (!label) continue;
    if (label.endsWith(":")) {
      const next = children[i + 1];
      const value = (next == null ? void 0 : next.nodeType) === Node.TEXT_NODE ? textOf(next) : "";
      fields.push({ key: label.slice(0, -1).trim(), value });
    } else {
      fields.push({ key: "__type", value: label });
    }
  }
  return fields;
}
function parseAnnotationsDiv(div) {
  var _a;
  const data = { highlights: [] };
  const spans = Array.from(div.children).filter((c) => c.tagName === "SPAN");
  for (const span of spans) {
    const fields = extractFields(span);
    const map = new Map(fields.map((f) => [f.key, f.value]));
    const chapterField = fields.find((f) => f.key.startsWith("Chapter") && f.key !== "Chapter progress");
    if (!chapterField) continue;
    data.highlights.push({
      chapterLabel: chapterField.key,
      chapterTitle: chapterField.value,
      type: (_a = map.get("__type")) != null ? _a : "Highlight",
      progress: map.get("Chapter progress"),
      quote: map.get("Highlight") || void 0,
      note: map.get("Note") || void 0
    });
  }
  return data;
}
function blockquote(text) {
  return text.split("\n").map((l) => "> " + l).join("\n");
}
function annotationsToMd(data) {
  if (data.highlights.length === 0) return "";
  const parts = [];
  let lastChapter = null;
  for (const h of data.highlights) {
    if (h.chapterLabel !== lastChapter) {
      parts.push(`### ${h.chapterLabel} \u2014 ${h.chapterTitle}`);
      lastChapter = h.chapterLabel;
    }
    if (h.quote) parts.push(blockquote(h.quote));
    if (h.note) parts.push(`**Note:** ${h.note}`);
  }
  return parts.join("\n\n");
}

// src/htmlToMd.ts
function htmlToMd(html) {
  if (!html || html.trim() === "") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return walkNode(doc.body).replace(/\n{3,}/g, "\n\n").trim();
}
function walkNode(node) {
  var _a, _b;
  if (node.nodeType === Node.TEXT_NODE) {
    return (_a = node.textContent) != null ? _a : "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node;
  const tag = el.tagName.toLowerCase();
  const inner = () => Array.from(el.childNodes).map(walkNode).join("");
  switch (tag) {
    case "p":
      return "\n\n" + inner() + "\n\n";
    case "br":
      return "\n";
    case "b":
    case "strong":
      return "**" + inner() + "**";
    case "em":
    case "i":
      return "*" + inner() + "*";
    case "h1":
      return "\n\n# " + inner() + "\n\n";
    case "h2":
      return "\n\n## " + inner() + "\n\n";
    case "h3":
      return "\n\n### " + inner() + "\n\n";
    case "h4":
      return "\n\n#### " + inner() + "\n\n";
    case "h5":
      return "\n\n##### " + inner() + "\n\n";
    case "h6":
      return "\n\n###### " + inner() + "\n\n";
    case "ul":
      return "\n" + Array.from(el.children).map((li) => "- " + walkNode(li).trim()).join("\n") + "\n";
    case "ol":
      return "\n" + Array.from(el.children).map((li, i) => `${i + 1}. ` + walkNode(li).trim()).join("\n") + "\n";
    case "li":
      return inner();
    case "a": {
      const href = (_b = el.getAttribute("href")) != null ? _b : "";
      const text = inner().trim();
      return href ? `[${text}](${href})` : text;
    }
    case "blockquote":
      return "\n" + inner().trim().split("\n").map((l) => "> " + l).join("\n") + "\n";
    case "hr":
      return "\n\n---\n\n";
    case "code":
      return "`" + el.textContent + "`";
    case "pre":
      return "\n\n```\n" + el.textContent + "\n```\n\n";
    default:
      return inner();
  }
}

// src/importModal.ts
var import_obsidian2 = require("obsidian");
var ImportModal = class extends import_obsidian2.Modal {
  constructor(app, books, onConfirm) {
    super(app);
    this.books = books;
    this.onConfirm = onConfirm;
    this.selected = /* @__PURE__ */ new Set();
    this.filtered = [];
    this.filtered = [...books];
  }
  onOpen() {
    this.modalEl.addClass("calibre-import-modal");
    const { contentEl } = this;
    contentEl.empty();
    const searchRow = contentEl.createDiv({ cls: "calibre-search-row" });
    const searchInput = searchRow.createEl("input", {
      cls: "calibre-search-input",
      attr: { type: "text", placeholder: "Search books\u2026" }
    });
    const selectAllBtn = searchRow.createEl("button", { text: "Select all" });
    selectAllBtn.addEventListener("click", () => {
      const allSelected = this.filtered.every((b) => this.selected.has(b.id));
      if (allSelected) {
        this.filtered.forEach((b) => this.selected.delete(b.id));
        selectAllBtn.textContent = "Select all";
      } else {
        this.filtered.forEach((b) => this.selected.add(b.id));
        selectAllBtn.textContent = "Deselect all";
      }
      this.renderList();
      this.updateCount();
    });
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.toLowerCase();
      this.filtered = q ? this.books.filter(
        (b) => b.title.toLowerCase().includes(q) || b.authors.some((a) => a.toLowerCase().includes(q))
      ) : [...this.books];
      this.renderList();
    });
    this.listEl = contentEl.createDiv({ cls: "calibre-book-list" });
    this.renderList();
    const footer = contentEl.createDiv({ cls: "calibre-footer" });
    this.countEl = footer.createSpan({ cls: "calibre-footer-count" });
    const btnRow = footer.createDiv({ attr: { style: "display:flex;gap:8px" } });
    const cancelBtn = btnRow.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());
    this.importBtn = btnRow.createEl("button", { text: "Import", cls: "mod-cta" });
    this.importBtn.addEventListener("click", () => {
      this.onConfirm(Array.from(this.selected));
      this.close();
    });
    this.updateCount();
  }
  renderList() {
    this.listEl.empty();
    for (const book of this.filtered) {
      const row = this.listEl.createDiv({ cls: "calibre-book-item" });
      const checkbox = row.createEl("input", {
        attr: { type: "checkbox", id: `cb-${book.id}` }
      });
      checkbox.checked = this.selected.has(book.id);
      const authorStr = book.authors.length > 0 ? book.authors[0] : "Unknown";
      row.createEl("label", {
        text: `${book.title} \u2014 ${authorStr}`,
        attr: { for: `cb-${book.id}` }
      });
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          this.selected.add(book.id);
        } else {
          this.selected.delete(book.id);
        }
        this.updateCount();
      });
      row.addEventListener("click", (e) => {
        if (e.target.tagName !== "INPUT") {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event("change"));
        }
      });
    }
  }
  updateCount() {
    const n = this.selected.size;
    this.countEl.textContent = `${n} of ${this.books.length} selected`;
    this.importBtn.textContent = n > 0 ? `Import ${n} book${n === 1 ? "" : "s"}` : "Import";
    this.importBtn.disabled = n === 0;
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/mapper.ts
var NONE_VALUES = /* @__PURE__ */ new Set(["None", "none", ""]);
function isBlank(v) {
  return v === null || v === void 0 || typeof v === "string" && NONE_VALUES.has(v);
}
function isoDate(raw) {
  if (!raw || NONE_VALUES.has(raw)) return null;
  const date = raw.slice(0, 10);
  if (date === "0001-01-01") return null;
  return date;
}
function toCalibreKeys(book, calibreId, coverFolder, hasCover) {
  var _a;
  const out = {};
  out.title = book.title;
  if (Array.isArray(book.authors) && book.authors.length > 0) {
    out.authors = book.authors;
  }
  if (!isBlank(book.series)) {
    out.series = book.series;
  }
  if (book.series_index !== null && book.series_index !== void 0) {
    out.series_index = book.series_index;
  }
  if (book.rating !== null && book.rating !== void 0 && book.rating !== 0) {
    out.rating = Math.round(book.rating / 2 * 10) / 10;
  }
  if (Array.isArray(book.tags) && book.tags.length > 0) {
    out.tags = book.tags;
  }
  if (!isBlank(book.publisher)) {
    out.publisher = book.publisher;
  }
  const pub = isoDate(book.pubdate);
  if (pub) out.published = pub;
  if (Array.isArray(book.languages) && book.languages.length > 0 && !isBlank(book.languages[0])) {
    out.language = book.languages[0];
  }
  if (((_a = book.identifiers) == null ? void 0 : _a.isbn) && !isBlank(book.identifiers.isbn)) {
    out.isbn = book.identifiers.isbn;
  }
  out.calibre_uuid = book.uuid;
  out.calibre_id = calibreId;
  const ts = isoDate(book.timestamp);
  if (ts) out.date_added = ts;
  if (hasCover) {
    out.cover = `[[${coverFolder}/${book.uuid}.jpg]]`;
  }
  return out;
}

// src/noteWriter.ts
var import_obsidian3 = require("obsidian");
var BEGIN_MARKER = "<!-- calibre:begin -->";
var END_MARKER = "<!-- calibre:end -->";
function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 100);
}
function resolveNewFilePath(app, book, settings) {
  return __async(this, null, function* () {
    var _a;
    const title = sanitizeFilename(book.title);
    const author = ((_a = book.authors) == null ? void 0 : _a[0]) ? sanitizeFilename(book.authors[0]) : null;
    const { bookFolder, filenameFormat } = settings;
    const tryPath = (name) => (0, import_obsidian3.normalizePath)(`${bookFolder}/${name}.md`);
    if (filenameFormat === "author-title") {
      const base = author ? `${author} \u2014 ${title}` : title;
      if (!app.vault.getAbstractFileByPath(tryPath(base))) return tryPath(base);
      for (let n = 2; n < 100; n++) {
        const s = `${base} ${n}`;
        if (!app.vault.getAbstractFileByPath(tryPath(s))) return tryPath(s);
      }
      return tryPath(`${base}-${Date.now()}`);
    }
    if (!app.vault.getAbstractFileByPath(tryPath(title))) return tryPath(title);
    if (author) {
      const withAuthor = `${title} \u2014 ${author}`;
      if (!app.vault.getAbstractFileByPath(tryPath(withAuthor))) return tryPath(withAuthor);
    }
    for (let n = 2; n < 100; n++) {
      const s = author ? `${title} \u2014 ${author} ${n}` : `${title} ${n}`;
      if (!app.vault.getAbstractFileByPath(tryPath(s))) return tryPath(s);
    }
    return tryPath(`${title}-${Date.now()}`);
  });
}
function serializeFrontmatter(fm) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fm)) {
    if (v === null || v === void 0) {
      lines.push(`${k}:`);
      continue;
    }
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) {
        lines.push(`  - ${JSON.stringify(item)}`);
      }
    } else if (typeof v === "string") {
      if (v.startsWith("[[") || v.includes(":") || v.includes("#")) {
        lines.push(`${k}: "${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${k}: ${v}`);
      }
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}
function buildManagedSection(sections) {
  const parts = [];
  if (sections.descriptionMd.trim()) {
    parts.push(`## Description
${sections.descriptionMd.trim()}`);
  }
  if (sections.highlightsMd.trim()) {
    parts.push(`## Highlights
${sections.highlightsMd.trim()}`);
  }
  if (parts.length === 0) {
    return `${BEGIN_MARKER}
${END_MARKER}`;
  }
  return `${BEGIN_MARKER}
${parts.join("\n\n")}
${END_MARKER}`;
}
function createNote(app, book, calibreKeys, sections, hasCover, settings) {
  return __async(this, null, function* () {
    const filePath = yield resolveNewFilePath(app, book, settings);
    const fm = __spreadProps(__spreadValues({}, calibreKeys), {
      status: "unread",
      date_started: null,
      date_finished: null
    });
    const fmStr = serializeFrontmatter(fm);
    const coverEmbed = hasCover ? `![[${settings.coverFolder}/${book.uuid}.jpg]]

` : "";
    const body = [
      fmStr,
      "",
      coverEmbed + buildManagedSection(sections),
      "",
      "<!-- everything below this line is yours; it is never touched on re-import -->"
    ].join("\n");
    yield ensureFolder(app, settings.bookFolder);
    return app.vault.create(filePath, body);
  });
}
function updateNote(app, file, calibreKeys, sections, hasCover, settings) {
  return __async(this, null, function* () {
    var _a;
    const uuid = String((_a = calibreKeys.calibre_uuid) != null ? _a : "");
    yield app.fileManager.processFrontMatter(file, (fm) => {
      const safeFm = fm;
      for (const [k, v] of Object.entries(calibreKeys)) {
        safeFm[k] = v;
      }
      if (!hasCover) {
        delete safeFm["cover"];
      }
    });
    const content = yield app.vault.read(file);
    const updated = updateBody(content, sections, hasCover, uuid, settings);
    if (updated !== content) {
      yield app.vault.modify(file, updated);
    }
  });
}
function updateBody(content, sections, hasCover, uuid, settings) {
  const beginIdx = content.indexOf(BEGIN_MARKER);
  const endIdx = content.indexOf(END_MARKER);
  const newSection = buildManagedSection(sections);
  const coverEmbed = `![[${settings.coverFolder}/${uuid}.jpg]]`;
  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    const before = content.slice(0, beginIdx);
    const after = content.slice(endIdx + END_MARKER.length);
    const beforeFixed = syncCoverEmbed(before, coverEmbed, hasCover);
    return beforeFixed + newSection + after;
  }
  const coverLine = hasCover ? `
${coverEmbed}

` : "\n\n";
  return content.trimEnd() + coverLine + newSection + "\n";
}
function syncCoverEmbed(before, coverEmbed, hasCover) {
  var _a;
  const embedRegex = /!\[\[.*?\]\]\n*/;
  const trimmed = before.trimEnd();
  const hasExistingEmbed = embedRegex.test((_a = trimmed.split("\n").pop()) != null ? _a : "");
  if (hasCover) {
    if (hasExistingEmbed) {
      const lines = trimmed.split("\n");
      lines[lines.length - 1] = coverEmbed;
      return lines.join("\n") + "\n\n";
    } else {
      return trimmed + "\n\n" + coverEmbed + "\n\n";
    }
  } else {
    if (hasExistingEmbed) {
      const lines = trimmed.split("\n");
      lines.pop();
      return lines.join("\n").trimEnd() + "\n\n";
    }
    return before;
  }
}
function buildUuidMap(app, settings) {
  var _a;
  const prefix = (0, import_obsidian3.normalizePath)(settings.bookFolder) + "/";
  const map = /* @__PURE__ */ new Map();
  for (const file of app.vault.getMarkdownFiles()) {
    if (!file.path.startsWith(prefix)) continue;
    const frontmatter = (_a = app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
    const uuid = frontmatter == null ? void 0 : frontmatter["calibre_uuid"];
    if (uuid) map.set(String(uuid), file);
  }
  return map;
}
function saveCover(app, settings, uuid, data) {
  return __async(this, null, function* () {
    yield ensureFolder(app, settings.coverFolder);
    const path = (0, import_obsidian3.normalizePath)(`${settings.coverFolder}/${uuid}.jpg`);
    yield app.vault.adapter.writeBinary(path, data);
  });
}
function ensureFolder(app, folder) {
  return __async(this, null, function* () {
    const path = (0, import_obsidian3.normalizePath)(folder);
    try {
      if (!app.vault.getAbstractFileByPath(path)) {
        yield app.vault.createFolder(path);
      }
    } catch (e) {
    }
  });
}

// src/settings.ts
var import_obsidian4 = require("obsidian");
var DEFAULT_SETTINGS = {
  serverUrl: "http://localhost:8080",
  libraryId: "",
  username: "",
  password: "",
  bookFolder: "Books",
  coverFolder: "Books/covers",
  downloadCovers: true,
  filenameFormat: "title"
};
var CalibreSettingTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.libraryDropdownEl = null;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian4.Setting(containerEl).setName("Server URL").setDesc("Base URL of the Calibre Content Server (no trailing slash).").addText(
      (text) => text.setPlaceholder("http://192.168.0.25:8080").setValue(this.plugin.settings.serverUrl).onChange((value) => __async(this, null, function* () {
        this.plugin.settings.serverUrl = value.trim().replace(/\/$/, "");
        yield this.plugin.saveSettings();
      }))
    );
    new import_obsidian4.Setting(containerEl).setName("Authentication (optional)").setDesc("Credentials are stored in plugin data in plaintext.").setHeading();
    new import_obsidian4.Setting(containerEl).setName("Username").addText(
      (text) => text.setValue(this.plugin.settings.username).onChange((value) => __async(this, null, function* () {
        this.plugin.settings.username = value;
        yield this.plugin.saveSettings();
      }))
    );
    new import_obsidian4.Setting(containerEl).setName("Password").addText((text) => {
      text.inputEl.type = "password";
      text.setValue(this.plugin.settings.password).onChange((value) => __async(this, null, function* () {
        this.plugin.settings.password = value;
        yield this.plugin.saveSettings();
      }));
    });
    new import_obsidian4.Setting(containerEl).setName("Library").setHeading();
    const libSetting = new import_obsidian4.Setting(containerEl).setName("Library").setDesc("Libraries are fetched automatically. Click the button to refresh.");
    const selectEl = activeDocument.createElement("select");
    selectEl.setCssStyles({ minWidth: "200px" });
    this.libraryDropdownEl = selectEl;
    if (this.plugin.settings.libraryId) {
      const opt = selectEl.createEl("option");
      opt.value = this.plugin.settings.libraryId;
      opt.text = this.plugin.settings.libraryId;
      opt.selected = true;
    } else {
      const opt = selectEl.createEl("option");
      opt.value = "";
      opt.text = "Fetching\u2026";
      opt.disabled = true;
      opt.selected = true;
    }
    selectEl.addEventListener("change", () => {
      this.plugin.settings.libraryId = selectEl.value;
      void this.plugin.saveSettings();
    });
    libSetting.controlEl.appendChild(selectEl);
    libSetting.addButton(
      (btn) => btn.setButtonText("Fetch libraries").onClick(() => __async(this, null, function* () {
        yield this.fetchLibraries({ silent: false });
      }))
    );
    new import_obsidian4.Setting(containerEl).setName("Vault folders").setHeading();
    new import_obsidian4.Setting(containerEl).setName("Book folder").setDesc("Vault folder where book notes are created.").addText(
      (text) => text.setPlaceholder("Books").setValue(this.plugin.settings.bookFolder).onChange((value) => __async(this, null, function* () {
        this.plugin.settings.bookFolder = value.trim().replace(/\/$/, "");
        yield this.plugin.saveSettings();
      }))
    );
    new import_obsidian4.Setting(containerEl).setName("Cover folder").setDesc("Vault folder where cover images are saved.").addText(
      (text) => text.setPlaceholder("Books/covers").setValue(this.plugin.settings.coverFolder).onChange((value) => __async(this, null, function* () {
        this.plugin.settings.coverFolder = value.trim().replace(/\/$/, "");
        yield this.plugin.saveSettings();
      }))
    );
    new import_obsidian4.Setting(containerEl).setName("Download covers").setDesc("Download cover images when importing books.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.downloadCovers).onChange((value) => __async(this, null, function* () {
        this.plugin.settings.downloadCovers = value;
        yield this.plugin.saveSettings();
      }))
    );
    new import_obsidian4.Setting(containerEl).setName("Note filename").setDesc("How new book notes are named. Existing notes are never renamed.").addDropdown(
      (dropdown) => dropdown.addOption("title", "Title").addOption("author-title", "Author \u2014 Title").setValue(this.plugin.settings.filenameFormat).onChange((value) => __async(this, null, function* () {
        this.plugin.settings.filenameFormat = value;
        yield this.plugin.saveSettings();
      }))
    );
    if (this.plugin.settings.serverUrl) {
      void this.fetchLibraries({ silent: true });
    }
  }
  fetchLibraries(_0) {
    return __async(this, arguments, function* ({ silent }) {
      const { serverUrl, username, password } = this.plugin.settings;
      if (!serverUrl) {
        if (!silent) new import_obsidian4.Notice("Please enter a server URL first.");
        return;
      }
      try {
        const headers = {};
        if (username && password) {
          headers["Authorization"] = "Basic " + btoa(`${username}:${password}`);
        }
        const res = yield (0, import_obsidian4.requestUrl)({
          url: `${serverUrl}/ajax/library-info`,
          method: "GET",
          headers
        });
        const data = res.json;
        if (!this.libraryDropdownEl) return;
        const sel = this.libraryDropdownEl;
        const entries = Object.entries(data.library_map);
        sel.empty();
        for (const [id, name] of entries) {
          const opt = sel.createEl("option");
          opt.value = id;
          opt.text = name ? `${name} (${id})` : id;
        }
        const savedStillValid = this.plugin.settings.libraryId && data.library_map[this.plugin.settings.libraryId] !== void 0;
        let toSelect;
        if (savedStillValid) {
          toSelect = this.plugin.settings.libraryId;
        } else if (entries.length === 1) {
          toSelect = entries[0][0];
        } else {
          toSelect = data.default_library;
        }
        sel.value = toSelect;
        if (this.plugin.settings.libraryId !== toSelect) {
          this.plugin.settings.libraryId = toSelect;
          yield this.plugin.saveSettings();
        }
        if (!silent) {
          const count = entries.length;
          const msg = count === 1 ? `1 library found and selected automatically.` : `${count} libraries found.`;
          new import_obsidian4.Notice(`Calibre Bridge: ${msg}`);
        }
      } catch (e) {
        if (silent) return;
        const status = e == null ? void 0 : e.status;
        if (status === 401) {
          new import_obsidian4.Notice("Calibre Bridge: Unauthorized (401). Check username and password.");
        } else {
          const msg = e instanceof Error ? e.message : String(e);
          new import_obsidian4.Notice(`Calibre Bridge: Could not connect \u2014 ${msg}`);
        }
      }
    });
  }
};

// src/main.ts
var CalibreBridgePlugin = class extends import_obsidian5.Plugin {
  onload() {
    return __async(this, null, function* () {
      yield this.loadSettings();
      this.registerPropertyTypes();
      this.addSettingTab(new CalibreSettingTab(this.app, this));
      this.addCommand({
        id: "calibre-import-books",
        name: "Import books from Calibre",
        callback: () => this.runImport()
      });
      this.addCommand({
        id: "calibre-create-library-overview",
        name: "Create library overview",
        callback: () => this.createLibraryOverview()
      });
      this.addCommand({
        id: "calibre-sync-imported",
        name: "Sync all imported books",
        callback: () => {
          void this.runSync();
        }
      });
    });
  }
  registerPropertyTypes() {
    const mgr = this.app.metadataTypeManager;
    if (!mgr) return;
    const register = (prop, type) => {
      var _a;
      if (!((_a = mgr.getPropertyInfo(prop)) == null ? void 0 : _a.type)) {
        mgr.setType(prop, type);
      }
    };
    for (const prop of ["date_started", "date_finished", "published", "date_added"]) {
      register(prop, "date");
    }
    for (const prop of ["rating", "series_index", "calibre_id"]) {
      register(prop, "number");
    }
  }
  loadSettings() {
    return __async(this, null, function* () {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
    });
  }
  saveSettings() {
    return __async(this, null, function* () {
      yield this.saveData(this.settings);
    });
  }
  createLibraryOverview() {
    return __async(this, null, function* () {
      const { bookFolder } = this.settings;
      const path = (0, import_obsidian5.normalizePath)(`${bookFolder}/Library.base`);
      const content = buildLibraryBase(bookFolder);
      try {
        const existing = this.app.vault.getAbstractFileByPath(path);
        if (existing) {
          yield this.app.vault.modify(existing, content);
        } else {
          yield this.app.vault.create(path, content);
        }
        new import_obsidian5.Notice(`Calibre Bridge: Library overview created at ${path}`);
      } catch (e) {
        new import_obsidian5.Notice(`Calibre Bridge: Could not create overview \u2014 ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  }
  runSync() {
    return __async(this, null, function* () {
      var _a;
      if (!this.settings.serverUrl) {
        new import_obsidian5.Notice("Calibre Bridge: Please enter a server URL in settings.");
        return;
      }
      if (!this.settings.libraryId) {
        new import_obsidian5.Notice("Calibre Bridge: Please select a library in settings first.");
        return;
      }
      const prefix = (0, import_obsidian5.normalizePath)(this.settings.bookFolder) + "/";
      const ids = [];
      for (const file of this.app.vault.getMarkdownFiles()) {
        if (!file.path.startsWith(prefix)) continue;
        const fm = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
        const calibreId = fm == null ? void 0 : fm["calibre_id"];
        if (calibreId !== void 0 && calibreId !== null) {
          ids.push(Number(calibreId));
        }
      }
      if (ids.length === 0) {
        new import_obsidian5.Notice("Calibre Bridge: No imported books found in vault.");
        return;
      }
      const api = new CalibreApi(this.settings);
      const fetchNotice = new import_obsidian5.Notice(`Calibre: Fetching metadata for ${ids.length} books\u2026`, 0);
      try {
        const allMeta = yield api.getBooks(ids);
        fetchNotice.hide();
        yield this.importBooks(api, allMeta, ids);
      } catch (e) {
        fetchNotice.hide();
      }
    });
  }
  runImport() {
    return __async(this, null, function* () {
      if (!this.settings.serverUrl) {
        new import_obsidian5.Notice("Calibre Bridge: Please enter a server URL in settings.");
        return;
      }
      if (!this.settings.libraryId) {
        new import_obsidian5.Notice("Calibre Bridge: Please select a library in settings first.");
        return;
      }
      const api = new CalibreApi(this.settings);
      const fetchNotice = new import_obsidian5.Notice("Calibre: Fetching book list\u2026", 0);
      try {
        const ids = yield api.searchBooks();
        if (ids.length === 0) {
          fetchNotice.hide();
          new import_obsidian5.Notice("Calibre: No books found in this library.");
          return;
        }
        fetchNotice.setMessage(`Calibre: Fetching metadata for ${ids.length} books\u2026`);
        const allMeta = yield api.getBooks(ids);
        fetchNotice.hide();
        const bookList = Object.entries(allMeta).map(([id, book]) => {
          var _a, _b;
          return {
            id: Number(id),
            title: (_a = book.title) != null ? _a : "(no title)",
            authors: (_b = book.authors) != null ? _b : []
          };
        });
        bookList.sort((a, b) => a.title.localeCompare(b.title));
        new ImportModal(this.app, bookList, (selectedIds) => {
          void this.importBooks(api, allMeta, selectedIds);
        }).open();
      } catch (e) {
        fetchNotice.hide();
      }
    });
  }
  importBooks(api, allMeta, selectedIds) {
    return __async(this, null, function* () {
      var _a;
      const uuidMap = buildUuidMap(this.app, this.settings);
      let created = 0, updated = 0, failed = 0;
      const progressNotice = new import_obsidian5.Notice(
        `Calibre: Importing 0 / ${selectedIds.length}\u2026`,
        0
      );
      for (let i = 0; i < selectedIds.length; i++) {
        const id = selectedIds[i];
        progressNotice.setMessage(
          `Calibre: Importing ${i + 1} / ${selectedIds.length}\u2026`
        );
        try {
          const book = allMeta[String(id)];
          if (!book) {
            failed++;
            continue;
          }
          let hasCover = false;
          if (this.settings.downloadCovers) {
            const coverPath = (0, import_obsidian5.normalizePath)(
              `${this.settings.coverFolder}/${book.uuid}.jpg`
            );
            const alreadyExists = yield this.app.vault.adapter.exists(coverPath);
            if (alreadyExists) {
              hasCover = true;
            } else {
              const coverData = yield api.getCover(id);
              if (coverData) {
                yield saveCover(this.app, this.settings, book.uuid, coverData);
                hasCover = true;
              }
            }
          }
          const calibreKeys = toCalibreKeys(book, id, this.settings.coverFolder, hasCover);
          const { descriptionHtml, annotations } = splitCommentsHtml((_a = book.comments) != null ? _a : "");
          const sections = {
            descriptionMd: htmlToMd(descriptionHtml),
            highlightsMd: annotations ? annotationsToMd(annotations) : ""
          };
          const existingFile = uuidMap.get(book.uuid);
          if (existingFile) {
            yield updateNote(
              this.app,
              existingFile,
              calibreKeys,
              sections,
              hasCover,
              this.settings
            );
            updated++;
          } else {
            yield createNote(
              this.app,
              book,
              calibreKeys,
              sections,
              hasCover,
              this.settings
            );
            created++;
          }
        } catch (e) {
          console.error(`Calibre Bridge: Failed to import book ${id}:`, e);
          failed++;
        }
      }
      progressNotice.hide();
      const failMsg = failed > 0 ? `, ${failed} failed` : "";
      new import_obsidian5.Notice(
        `Calibre import done: ${created} created, ${updated} updated${failMsg}.`
      );
    });
  }
};
function buildLibraryBase(bookFolder) {
  const f = bookFolder;
  return `views:
  - type: table
    name: All Books
    filters:
      and:
        - file.folder == "${f}"
    order:
      - cover
      - title
      - authors
      - status
      - rating
      - date_added
    sort:
      - property: date_added
        direction: DESC

  - type: table
    name: Reading
    filters:
      and:
        - file.folder == "${f}"
        - status == "reading"
    order:
      - cover
      - title
      - authors
      - date_started
    sort:
      - property: date_started
        direction: DESC

  - type: table
    name: Unread
    filters:
      and:
        - file.folder == "${f}"
        - status == "unread"
    order:
      - cover
      - title
      - authors
      - rating
      - date_added
    sort:
      - property: date_added
        direction: DESC

  - type: table
    name: Read
    filters:
      and:
        - file.folder == "${f}"
        - status == "read"
    order:
      - cover
      - title
      - authors
      - rating
      - date_finished
    sort:
      - property: date_finished
        direction: DESC

  - type: table
    name: Did Not Finish
    filters:
      and:
        - file.folder == "${f}"
        - status == "did-not-finish"
    order:
      - cover
      - title
      - authors
`;
}

/* nosourcemap */