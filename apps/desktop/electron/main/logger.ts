import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type LogLevel = 'info' | 'warn' | 'error';

const SENSITIVE_KEY_PATTERN = /(pass(word)?|secret|token|credential|hash)/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 3) {
    return '[truncated]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : redact(item, depth + 1);
    }
    return result;
  }
  return value;
}

/**
 * Minimal structured logger. Writes JSON lines to the user data directory so
 * support issues can be diagnosed without leaking credentials
 * (TECHNICAL_SPECIFICATION.md §9, API contract §13).
 */
export class FileLogger {
  readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    mkdirSync(dirname(filePath), { recursive: true });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write('error', message, meta);
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta ? { meta: redact(meta) } : {}),
    };
    const line = JSON.stringify(entry);

    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }

    try {
      appendFileSync(this.filePath, `${line}\n`, 'utf8');
    } catch (error) {
      console.error('ConDeck logger could not write to disk', error);
    }
  }
}
