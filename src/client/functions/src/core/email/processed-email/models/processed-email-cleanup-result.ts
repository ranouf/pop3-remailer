export class ProcessedEmailCleanupResult {
  public readonly deletedCount: number;
  public readonly retainedCount: number;

  public constructor(params: {
    readonly deletedCount: number;
    readonly retainedCount: number;
  }) {
    this.deletedCount = params.deletedCount;
    this.retainedCount = params.retainedCount;
  }
}
