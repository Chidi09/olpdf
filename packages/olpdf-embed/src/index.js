export class OlPDFEmbed {
  constructor(container, options) {
    if (!container) throw new Error("container is required");
    this.options = options || {};
    this.host = this.options.host || "";
    this.documentId = this.options.documentId || "";
    this.token = this.options.token || "";
    this.handlers = new Map();

    const iframe = document.createElement("iframe");
    iframe.src = `${this.host}/embed/${this.documentId}?token=${encodeURIComponent(this.token)}`;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    container.appendChild(iframe);
    this.iframe = iframe;

    this._onMessage = (event) => {
      if (this.host && event.origin !== new URL(this.host).origin) return;
      const payload = event.data || {};
      const list = this.handlers.get(payload.type) || [];
      list.forEach((fn) => fn(payload.data));
    };
    window.addEventListener("message", this._onMessage);
  }

  post(type, data) {
    this.iframe?.contentWindow?.postMessage({ type, data }, "*");
  }

  load(buffer) {
    this.post("LOAD", { buffer });
  }

  setTheme(theme) {
    this.post("SET_THEME", { theme });
  }

  download() {
    this.post("DOWNLOAD", {});
  }

  on(event, handler) {
    const list = this.handlers.get(event) || [];
    list.push(handler);
    this.handlers.set(event, list);
  }

  destroy() {
    window.removeEventListener("message", this._onMessage);
    this.iframe?.remove();
  }
}
