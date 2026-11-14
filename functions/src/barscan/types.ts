// BARPHOTO-3. Shapes shared by the scanBar callable and its handler.

export type Confidence = 'high' | 'medium' | 'low';

export interface ScanBarRequest {
  /** Invite code, 8-64 of A-Z a-z 0-9 -. Whoever holds it spends the owner's daily allowance. */
  code: string;
  /** The photo, base64 (no data: prefix). */
  image: string;
  /** image/jpeg | image/png | image/webp | image/heic | image/heif */
  mimeType: string;
  /** The app's bottle names; the model answers in these words when it can. */
  vocab?: string[];
}

export interface ScannedBottle {
  /** What the label says, e.g. "Maker's Mark". */
  label: string;
  /** Generic kind, lower case, e.g. "bourbon". */
  type: string;
  /** One entry of the request's vocab, or "" when nothing fits. */
  key: string;
  confidence: Confidence;
}

export interface ScanBarResult {
  bottles: ScannedBottle[];
  /** Non-alcohol items seen (mixers, fruit, tools), short lower-case names. */
  other: string[];
}

export interface UsageStore {
  get(uid: string, day: string): Promise<number>;
  increment(uid: string, day: string): Promise<void>;
}

export interface CodeEntry {
  enabled: boolean;
  /** Who the code is for. Safe to log; the code itself is not. */
  label: string;
  /** Own daily cap, a whole number 1-200; otherwise the default applies. */
  dailyCap?: number;
}

export interface BarScanDeps {
  /** Looks a (shape-checked) code up. null = no such code. */
  codes: { get(code: string): Promise<CodeEntry | null> };
  /** Returns the model's raw text answer. Throws an Error whose message carries the HTTP status on failure. */
  askModel(imageBase64: string, mimeType: string, prompt: string, schema: unknown): Promise<string>;
  usage: UsageStore;
  /** Epoch milliseconds. */
  now(): number;
  /** Optional, so tests can skip real waiting. Defaults to setTimeout. */
  sleep?(ms: number): Promise<void>;
  /** Structured log line. Never pass image data here. */
  log(message: string, fields: Record<string, unknown>): void;
}
