export const OLPDF_PROTOCOL_VERSION = 1 as const;

export type OlpdfProtocolVersion = typeof OLPDF_PROTOCOL_VERSION;

export type OlpdfEnvelope<TType extends string = string, TPayload = unknown> = {
  olpdf: OlpdfProtocolVersion;
  id: string;
  type: TType;
  payload: TPayload;
  replyTo?: string;
};

export type EmbedCommand =
  | "command:loadDocument"
  | "command:setReadOnly"
  | "command:setTheme"
  | "command:triggerExport"
  | "command:getDocument"
  | "command:applyOperations";

export type EmbedEvent =
  | "event:ready"
  | "event:modelUpdate"
  | "event:pageAdded"
  | "event:pageRemoved"
  | "event:save"
  | "event:exportComplete"
  | "event:selectionChange"
  | "event:dirtyChange"
  | "event:error";

export function createEnvelope<TType extends string, TPayload>(type: TType, payload: TPayload): OlpdfEnvelope<TType, TPayload> {
  return {
    olpdf: OLPDF_PROTOCOL_VERSION,
    id: crypto.randomUUID(),
    type,
    payload,
  };
}

export function isOlpdfEnvelope(value: unknown): value is OlpdfEnvelope {
  return Boolean(value && typeof value === "object" && (value as { olpdf?: unknown }).olpdf === OLPDF_PROTOCOL_VERSION);
}
