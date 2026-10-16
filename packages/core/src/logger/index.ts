export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  module: string;
  msg: string;
  ctx?: Record<string, unknown>;
}

export type LogSink = (entry: LogEntry) => void;

export interface Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export const consoleSink: LogSink = (entry) => {
  const prefix = `[ls:${entry.module}]`;
  const message = entry.ctx === undefined ? entry.msg : `${entry.msg} ${JSON.stringify(entry.ctx)}`;
  if (entry.level === 'error') {
    console.error(prefix, message);
  } else if (entry.level === 'warn') {
    console.warn(prefix, message);
  } else {
    console.log(prefix, message);
  }
};

/**
 * Crea un logger strutturato per modulo con schema `{level, module, msg, ctx}`.
 * Nessun dato personale deve transitare in `ctx` (vedi docs/09-PRIVACY-SECURITY.md).
 */
export function createLogger(
  module: string,
  sink: LogSink = consoleSink,
  minLevel: LogLevel = 'info',
): Logger {
  const emit =
    (level: LogLevel) =>
    (msg: string, ctx?: Record<string, unknown>): void => {
      if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel]) {
        return;
      }
      const entry: LogEntry =
        ctx === undefined ? { level, module, msg } : { level, module, msg, ctx };
      sink(entry);
    };

  return {
    debug: emit('debug'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
  };
}
