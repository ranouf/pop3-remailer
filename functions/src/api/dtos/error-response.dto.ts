export class ErrorResponseDto {
  public readonly error: string;

  public constructor(error: string) {
    this.error = error;
  }

  public static fromMessage(error: string): ErrorResponseDto {
    return new ErrorResponseDto(error);
  }
}
