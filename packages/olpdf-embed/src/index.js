export class OlPDFEmbed {
  constructor(container, options) {
    if (!container) throw new Error("container is required");
    this.options = options || {};
    this.host = this.options.host || "";
    this.documentId = this.options.documentId || "";
    this.token = this.options.token || "";
    this.handlers = new Map();

    const iframe = document.createElement("iframe");
    const embedOrigin = encodeURIComponent(window.location.origin);
    iframe.src = `${this.host}/embed/${this.documentId}?token=${encodeURIComponent(this.token)}&origin=${embedOrigin}`;
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
    const targetOrigin = this.host ? new URL(this.host).origin : "*";
    this.iframe?.contentWindow?.postMessage({ type, data }, targetOrigin);
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
    return () => {
      const current = this.handlers.get(event) || [];
      this.handlers.set(event, current.filter((fn) => fn !== handler));
    };
  }

  destroy() {
    window.removeEventListener("message", this._onMessage);
    this.iframe?.remove();
  }
}
