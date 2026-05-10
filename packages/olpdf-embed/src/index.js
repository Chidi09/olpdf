/**
 * @typedef {Object} DocumentModel Full OLPDF document model including rich_spans.
 *
 * @typedef {Object} ModelUpdatePayload
 * @property {string}        documentId    - Document being edited.
 * @property {DocumentModel} documentModel - Complete updated model including rich_spans,
 *   next_block_id, prev_block_id, and page_dimensions. Replaces the deprecated BLOCK_CHANGE.
 *
 * @typedef {Object} PageAddedPayload
 * @property {number} pageIndex - Zero-based index of the new overflow page.
 * @property {number} width     - Page width in PDF points.
 * @property {number} height    - Page height in PDF points.
 *
 * @typedef {Object} PageRemovedPayload
 * @property {number} pageIndex - Zero-based index of the removed page.
 *
 * @typedef {Object} SavePayload
 * @property {string} documentId
 * @property {number} blockCount
 * @property {number} pageCount
 *
 * Events emitted by the embed iframe:
 *  - READY          — editor mounted and ready
 *  - MODEL_UPDATE   — full DocumentModel after any edit (replaces deprecated BLOCK_CHANGE)
 *  - PAGE_ADDED     — layout engine added an overflow page
 *  - PAGE_REMOVED   — layout engine removed an overflow page
 *  - SAVE           — model saved (carries blockCount, pageCount)
 *  - EXPORT_COMPLETE — export finished, carries { url }
 *  - BLOCK_CHANGE   — @deprecated, use MODEL_UPDATE
 */
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

  /**
   * Subscribe to an embed event.
   *
   * @param {'MODEL_UPDATE'|'PAGE_ADDED'|'PAGE_REMOVED'|'SAVE'|'EXPORT_COMPLETE'|'READY'|'BLOCK_CHANGE'} event
   * @param {function} handler
   * @returns {function} Unsubscribe function.
   *
   * @example
   * // Receive full AST model on every edit (rich_spans, next_block_id, page_dimensions included)
   * editor.on('MODEL_UPDATE', ({ documentId, documentModel }) => {
   *   myDB.save(documentId, documentModel);
   * });
   *
   * @example
   * // React to dynamic page additions
   * editor.on('PAGE_ADDED', ({ pageIndex, width, height }) => {
   *   console.log(`Page ${pageIndex + 1} added (${width}×${height}pt)`);
   * });
   *
   * @example
   * // @deprecated — use MODEL_UPDATE for full rich-text data
   * editor.on('BLOCK_CHANGE', ({ blockId, content }) => { ... });
   */
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
