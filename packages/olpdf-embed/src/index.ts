import { createEnvelope, isOlpdfEnvelope, type EmbedEvent, type OlpdfEnvelope } from "./protocol";

export type DocumentModel = Record<string, unknown>;

export type OlPDFEmbedOptions = {
  host: string;
  documentId: string;
  token: string;
};

export type ThemeValue = "light" | "dark";

export type EventHandler<TPayload = unknown> = (payload: TPayload) => void;

export class OlPDFEmbed {
  readonly iframe: HTMLIFrameElement;
  private readonly hostOrigin: string;
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly onMessage: (event: MessageEvent) => void;

  constructor(container: HTMLElement, options: OlPDFEmbedOptions) {
    if (!container) throw new Error("container is required");
    if (!options.host) throw new Error("host is required");
    if (!options.documentId) throw new Error("documentId is required");
    if (!options.token) throw new Error("token is required");

    const hostUrl = new URL(options.host);
    this.hostOrigin = hostUrl.origin;

    const iframe = document.createElement("iframe");
    const parentOrigin = encodeURIComponent(window.location.origin);
    iframe.src = `${this.hostOrigin}/embed/${encodeURIComponent(options.documentId)}?token=${encodeURIComponent(options.token)}&origin=${parentOrigin}`;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-downloads allow-forms");
    iframe.referrerPolicy = "no-referrer";
    iframe.allow = "clipboard-write";
    container.appendChild(iframe);
    this.iframe = iframe;

    this.onMessage = (event) => {
      if (event.origin !== this.hostOrigin) return;
      if (!isOlpdfEnvelope(event.data)) return;
      const handlers = this.handlers.get(event.data.type);
      handlers?.forEach((handler) => handler(event.data.payload));
    };
    window.addEventListener("message", this.onMessage);
  }

  post<TPayload>(type: string, payload: TPayload): OlpdfEnvelope<string, TPayload> {
    const envelope = createEnvelope(type, payload);
    this.iframe.contentWindow?.postMessage(envelope, this.hostOrigin);
    return envelope;
  }

  loadDocument(documentId: string) {
    return this.post("command:loadDocument", { documentId });
  }

  setReadOnly(readOnly: boolean) {
    return this.post("command:setReadOnly", { readOnly });
  }

  setTheme(theme: ThemeValue) {
    return this.post("command:setTheme", { theme });
  }

  triggerExport(format: "pdf" | "docx" = "pdf") {
    return this.post("command:triggerExport", { format });
  }

  getDocument() {
    return this.post("command:getDocument", {});
  }

  on<TPayload = unknown>(event: EmbedEvent, handler: EventHandler<TPayload>) {
    const handlers = this.handlers.get(event) ?? new Set<EventHandler>();
    handlers.add(handler as EventHandler);
    this.handlers.set(event, handlers);
    return () => handlers.delete(handler as EventHandler);
  }

  destroy() {
    window.removeEventListener("message", this.onMessage);
    this.handlers.clear();
    this.iframe.remove();
  }
}

export type { EmbedCommand, EmbedEvent, OlpdfEnvelope } from "./protocol";
