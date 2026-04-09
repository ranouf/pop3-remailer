import swaggerDocument from '../generated/swagger.json';

type OpenApiInfo = Readonly<Record<string, unknown>> & {
  readonly title?: string;
  readonly version?: string;
};

type OpenApiDocumentShape = Readonly<Record<string, unknown>> & {
  readonly info?: OpenApiInfo;
};

export class OpenApiDocument {
  public static create(serverUrl: string): Record<string, unknown> {
    const baseDocument = OpenApiDocument.readDocument();

    return {
      ...baseDocument,
      info: {
        ...(baseDocument.info ?? {}),
        title: 'POP3 Remailer Operations API',
        version: '1.0.0',
      },
      openapi: '3.0.2',
      servers: [
        {
          url: serverUrl,
        },
      ],
    };
  }

  private static readDocument(): OpenApiDocumentShape {
    const candidate = swaggerDocument as unknown;

    if (!OpenApiDocument.isRecord(candidate)) {
      throw new Error('The generated OpenAPI document is invalid.');
    }

    const info = candidate.info;

    return {
      ...candidate,
      ...(OpenApiDocument.isRecord(info)
        ? {
            info,
          }
        : {}),
    };
  }

  private static isRecord(
    value: unknown,
  ): value is Readonly<Record<string, unknown>> {
    return typeof value === 'object' && value !== null;
  }
}
