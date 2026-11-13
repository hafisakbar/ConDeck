import { errorCodes, hexColorSchema, isoTimestampSchema } from '@condeck/shared';
import { z } from 'zod';
import { remoteDefaults, remoteErrorCodes, type RemoteErrorCode } from './protocol';

/**
 * Message contract between ConDeck Desktop (host) and ConDeck Mobile (client).
 * Every message follows API_WEBSOCKET_CONTRACT.md §4 and is validated with Zod
 * on both sides before anything is executed.
 */

const envelope = {
  requestId: z.uuid(),
  timestamp: isoTimestampSchema,
};

/** UUID v4 built from getRandomValues so it also works on a plain-HTTP LAN page. */
export function createRequestId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

// ------------------------------------------------------------------ payloads

export const authPairPayloadSchema = z
  .object({
    pairingToken: z.string().trim().min(20, 'Pairing code is incomplete.').max(256),
    deviceName: z.string().trim().min(1, 'Give this device a name.').max(60, 'Name is too long.'),
    deviceType: z.enum(['mobile', 'tablet', 'desktop']).default('mobile'),
  })
  .strict();

export const authResumePayloadSchema = z
  .object({
    deviceId: z.uuid(),
    deviceCredential: z.string().min(20).max(256),
  })
  .strict();

export const deckGetPayloadSchema = z.object({}).strict();

export const buttonPressPayloadSchema = z
  .object({
    buttonId: z.uuid(),
  })
  .strict();

export const pageChangePayloadSchema = z
  .object({
    pageId: z.uuid(),
  })
  .strict();

export const pingPayloadSchema = z.object({}).strict();

export const remoteButtonSchema = z
  .object({
    id: z.uuid(),
    position: z.number().int().nonnegative(),
    label: z.string(),
    icon: z.string().nullable(),
    backgroundColor: hexColorSchema,
    textColor: hexColorSchema,
    isEnabled: z.boolean(),
    /** Only the presence of an action is shared, never its configuration. */
    hasAction: z.boolean(),
  })
  .strict();

export const remotePageSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    position: z.number().int().nonnegative(),
    buttons: z.array(remoteButtonSchema),
  })
  .strict();

export const remoteDeckSnapshotSchema = z
  .object({
    deckId: z.uuid(),
    name: z.string(),
    columns: z.number().int().positive(),
    rows: z.number().int().positive(),
    pages: z.array(remotePageSchema),
  })
  .strict();

export const pairResultPayloadSchema = z
  .object({
    success: z.literal(true),
    deviceId: z.uuid(),
    /** Issued exactly once; the host keeps only its hash. */
    deviceCredential: z.string().min(20).max(256),
  })
  .strict();

export const authResultPayloadSchema = z
  .object({
    success: z.literal(true),
    deviceId: z.uuid(),
  })
  .strict();

export const deckUpdatedPayloadSchema = z.object({ deckId: z.uuid() }).strict();

export const actionStartedPayloadSchema = z.object({ buttonId: z.uuid() }).strict();

export const actionCompletedPayloadSchema = z
  .object({
    buttonId: z.uuid(),
    success: z.literal(true),
    message: z.string(),
  })
  .strict();

export const actionFailedPayloadSchema = z
  .object({
    buttonId: z.uuid(),
    success: z.literal(false),
    errorCode: z.enum(errorCodes),
    message: z.string(),
  })
  .strict();

export const pageChangedPayloadSchema = z
  .object({
    pageId: z.uuid(),
    pageIndex: z.number().int().nonnegative(),
  })
  .strict();

export const obsStatusPayloadSchema = z
  .object({
    connected: z.boolean(),
    streaming: z.boolean(),
    recording: z.boolean(),
    sceneName: z.string().nullable(),
  })
  .strict();

export const tiktokStatusPayloadSchema = z
  .object({
    connected: z.boolean(),
    sceneName: z.string().nullable(),
    micMuted: z.boolean(),
    audioMuted: z.boolean(),
    recording: z.boolean(),
    streamStatus: z.number().int().min(0).max(2),
  })
  .strict();

export const pongPayloadSchema = z.object({}).strict();

export const errorPayloadSchema = z
  .object({
    code: z.enum(remoteErrorCodes),
    message: z.string(),
    requestId: z.uuid().nullable(),
  })
  .strict();

// ------------------------------------------------------------------- schemas

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('auth.pair'), ...envelope, payload: authPairPayloadSchema }).strict(),
  z
    .object({ type: z.literal('auth.resume'), ...envelope, payload: authResumePayloadSchema })
    .strict(),
  z.object({ type: z.literal('deck.get'), ...envelope, payload: deckGetPayloadSchema }).strict(),
  z
    .object({ type: z.literal('button.press'), ...envelope, payload: buttonPressPayloadSchema })
    .strict(),
  z
    .object({ type: z.literal('page.change'), ...envelope, payload: pageChangePayloadSchema })
    .strict(),
  z.object({ type: z.literal('ping'), ...envelope, payload: pingPayloadSchema }).strict(),
]);

export const serverMessageSchema = z.discriminatedUnion('type', [
  z
    .object({ type: z.literal('auth.pair.result'), ...envelope, payload: pairResultPayloadSchema })
    .strict(),
  z.object({ type: z.literal('auth.result'), ...envelope, payload: authResultPayloadSchema }).strict(),
  z
    .object({
      type: z.literal('deck.snapshot'),
      ...envelope,
      /** `null` means the active profile has no deck yet. */
      payload: remoteDeckSnapshotSchema.nullable(),
    })
    .strict(),
  z.object({ type: z.literal('deck.updated'), ...envelope, payload: deckUpdatedPayloadSchema }).strict(),
  z.object({ type: z.literal('action.started'), ...envelope, payload: actionStartedPayloadSchema }).strict(),
  z
    .object({ type: z.literal('action.completed'), ...envelope, payload: actionCompletedPayloadSchema })
    .strict(),
  z.object({ type: z.literal('action.failed'), ...envelope, payload: actionFailedPayloadSchema }).strict(),
  z.object({ type: z.literal('page.changed'), ...envelope, payload: pageChangedPayloadSchema }).strict(),
  z.object({ type: z.literal('obs.status'), ...envelope, payload: obsStatusPayloadSchema }).strict(),
  z
    .object({ type: z.literal('tiktok.status'), ...envelope, payload: tiktokStatusPayloadSchema })
    .strict(),
  z.object({ type: z.literal('pong'), ...envelope, payload: pongPayloadSchema }).strict(),
  z.object({ type: z.literal('error'), ...envelope, payload: errorPayloadSchema }).strict(),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;
export type ClientMessageType = ClientMessage['type'];
export type ServerMessageType = ServerMessage['type'];
export type RemoteDeckSnapshot = z.infer<typeof remoteDeckSnapshotSchema>;
export type RemotePage = z.infer<typeof remotePageSchema>;
export type RemoteButton = z.infer<typeof remoteButtonSchema>;
export type ObsStatusPayload = z.infer<typeof obsStatusPayloadSchema>;
export type TikTokStatusPayload = z.infer<typeof tiktokStatusPayloadSchema>;

type ServerMessageOf<T extends ServerMessageType> = Extract<ServerMessage, { type: T }>;
type ClientMessageOf<T extends ClientMessageType> = Extract<ClientMessage, { type: T }>;

// ------------------------------------------------------------------ helpers

export function createClientMessage<T extends ClientMessageType>(
  type: T,
  payload: ClientMessageOf<T>['payload'],
  requestId: string = createRequestId(),
): ClientMessageOf<T> {
  return {
    type,
    requestId,
    timestamp: new Date().toISOString(),
    payload,
  } as ClientMessageOf<T>;
}

export function createServerMessage<T extends ServerMessageType>(
  type: T,
  payload: ServerMessageOf<T>['payload'],
  requestId: string = createRequestId(),
): ServerMessageOf<T> {
  return {
    type,
    requestId,
    timestamp: new Date().toISOString(),
    payload,
  } as ServerMessageOf<T>;
}

export function serializeMessage(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}

export type ClientMessageParse =
  | { ok: true; bytes: number; message: ClientMessage }
  | {
      ok: false;
      bytes: number;
      code: RemoteErrorCode;
      message: string;
      closeConnection: boolean;
      requestId: string | null;
    };

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'message'}: ${issue.message}`)
    .join('; ');
}

/**
 * Validates one inbound frame.
 *
 * Size is checked before parsing, and every rejection says whether the socket
 * should be closed (abuse) or can keep going (a single bad request).
 */
export function parseClientMessage(
  raw: string | Uint8Array,
  maxBytes: number = remoteDefaults.maxMessageBytes,
): ClientMessageParse {
  const bytes = typeof raw === 'string' ? new TextEncoder().encode(raw).byteLength : raw.byteLength;

  if (bytes > maxBytes) {
    return {
      ok: false,
      bytes,
      code: 'INVALID_REQUEST',
      message: `Message exceeds the ${maxBytes}-byte limit.`,
      closeConnection: true,
      requestId: null,
    };
  }

  const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    return {
      ok: false,
      bytes,
      code: 'INVALID_REQUEST',
      message: 'Message is not valid JSON.',
      closeConnection: false,
      requestId: null,
    };
  }

  const requestId =
    typeof parsedJson === 'object' &&
    parsedJson !== null &&
    typeof (parsedJson as { requestId?: unknown }).requestId === 'string'
      ? (parsedJson as { requestId: string }).requestId
      : null;

  const result = clientMessageSchema.safeParse(parsedJson);
  if (!result.success) {
    return {
      ok: false,
      bytes,
      code: 'INVALID_REQUEST',
      message: describeIssues(result.error),
      closeConnection: false,
      requestId,
    };
  }

  return { ok: true, bytes, message: result.data };
}

/** Validates a frame received by the mobile client from the host. */
export function parseServerMessage(raw: string): ServerMessage | null {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = serverMessageSchema.safeParse(parsedJson);
  return result.success ? result.data : null;
}
