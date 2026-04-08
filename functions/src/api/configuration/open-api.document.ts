import swaggerDocument from '../generated/swagger.json';

export class OpenApiDocument {
  public static create(serverUrl: string): object {
    return {
      ...swaggerDocument,
      info: {
        ...swaggerDocument.info,
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
}
