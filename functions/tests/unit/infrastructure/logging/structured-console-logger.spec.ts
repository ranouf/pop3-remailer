import {
  StructuredConsoleLogger,
  type LogEntry,
  type LoggerSink,
} from '../../../../src/infrastructure/logging/structured-console-logger';

class InMemorySink implements LoggerSink {
  public readonly entries: LogEntry[] = [];

  public write(entry: LogEntry): void {
    this.entries.push(entry);
  }
}

describe('infrastructure/logging/structured-console-logger', () => {
  it('writes structured log entries through the injected sink', () => {
    const sink = new InMemorySink();
    const logger = new StructuredConsoleLogger(sink);

    logger.info('Job started', {
      jobId: 'job-123',
    });

    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0]).toMatchObject({
      context: {
        jobId: 'job-123',
      },
      level: 'info',
      message: 'Job started',
    });
    expect(sink.entries[0]?.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/u,
    );
  });

  it('supports all log levels without requiring context', () => {
    const sink = new InMemorySink();
    const logger = new StructuredConsoleLogger(sink);

    logger.debug('Debug');
    logger.warn('Warning');
    logger.error('Error');

    expect(sink.entries.map((entry) => entry.level)).toEqual([
      'debug',
      'warn',
      'error',
    ]);
    expect(sink.entries.every((entry) => entry.context === undefined)).toBe(
      true,
    );
  });
});
