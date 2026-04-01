import type { StructuredLogger } from '../../domain/ports';

export interface LogEntry {
  readonly context?: Readonly<Record<string, unknown>>;
  readonly level: 'debug' | 'error' | 'info' | 'warn';
  readonly message: string;
  readonly timestamp: string;
}

export interface LoggerSink {
  write(entry: LogEntry): void;
}

export class ConsoleJsonSink implements LoggerSink {
  public write(entry: LogEntry): void {
    const payload =
      entry.context === undefined
        ? entry
        : {
            ...entry,
            context: entry.context,
          };

    console.log(JSON.stringify(payload));
  }
}

export class StructuredConsoleLogger implements StructuredLogger {
  private readonly sink: LoggerSink;

  public constructor(sink: LoggerSink = new ConsoleJsonSink()) {
    this.sink = sink;
  }

  public debug(
    message: string,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    this.write('debug', message, context);
  }

  public error(
    message: string,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    this.write('error', message, context);
  }

  public info(
    message: string,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    this.write('info', message, context);
  }

  public warn(
    message: string,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    this.write('warn', message, context);
  }

  private write(
    level: LogEntry['level'],
    message: string,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    this.sink.write({
      ...(context === undefined
        ? {}
        : {
            context,
          }),
      level,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
