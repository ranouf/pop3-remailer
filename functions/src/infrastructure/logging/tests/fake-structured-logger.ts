import type { StructuredLogger } from '../../../core/logging/structured-logger.interface';

export class FakeStructuredLogger implements StructuredLogger {
  public readonly debugCalls: Array<
    Readonly<Record<string, unknown>> | undefined
  > = [];
  public readonly errorCalls: Array<
    Readonly<Record<string, unknown>> | undefined
  > = [];
  public readonly infoCalls: Array<
    Readonly<Record<string, unknown>> | undefined
  > = [];
  public readonly warnCalls: Array<
    Readonly<Record<string, unknown>> | undefined
  > = [];

  public debug(
    _message: string,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    this.debugCalls.push(context);
  }

  public error(
    _message: string,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    this.errorCalls.push(context);
  }

  public info(
    _message: string,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    this.infoCalls.push(context);
  }

  public warn(
    _message: string,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    this.warnCalls.push(context);
  }
}
