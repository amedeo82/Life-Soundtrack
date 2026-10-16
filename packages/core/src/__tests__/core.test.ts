import { describe, expect, it } from 'vitest';
import { createLogger, type LogEntry } from '../logger';
import { PLATFORM_IDS } from '../schema';

describe('logger', () => {
  it('emette entry strutturate {level, module, msg, ctx}', () => {
    const entries: LogEntry[] = [];
    const logger = createLogger('test', (entry) => entries.push(entry));

    logger.info('import completato', { events: 10 });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: 'info',
      module: 'test',
      msg: 'import completato',
      ctx: { events: 10 },
    });
  });

  it('omette ctx quando assente', () => {
    const entries: LogEntry[] = [];
    const logger = createLogger('test', (entry) => entries.push(entry));

    logger.warn('nessun contesto');

    expect(entries).toHaveLength(1);
    expect(entries[0]).not.toHaveProperty('ctx');
  });

  it('rispetta il minLevel configurato', () => {
    const entries: LogEntry[] = [];
    const logger = createLogger('test', (entry) => entries.push(entry), 'warn');

    logger.info('filtrato');
    logger.error('passato');

    expect(entries).toHaveLength(1);
    expect(entries[0]?.level).toBe('error');
  });
});

describe('schema placeholder', () => {
  it('espone gli id piattaforma di 05-ARCHITECTURE.md §2', () => {
    expect(PLATFORM_IDS).toContain('spotify');
    expect(PLATFORM_IDS).toContain('manual');
    expect(new Set(PLATFORM_IDS).size).toBe(PLATFORM_IDS.length);
  });
});
