import express, { type Application, type RequestHandler } from 'express';
import { onRequest } from 'firebase-functions/v2/https';
import swaggerUi from 'swagger-ui-express';
import { Container } from 'inversify';

import type { StructuredLogger } from '../core/logging/structured-logger.interface';
import type { JobRunStatisticsManagerInterface } from '../core/job-run-statistics';
import type { HealthCheckManagerInterface } from '../core/health-check/health-check-manager.interface';
import { CoreModule } from '../core/core.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { RegisterRoutes } from './generated/routes';
import { ApiModule } from './api.module';
import type { AuthTokenVerifierInterface } from './auth/auth-token-verifier.interface';
import { OpenApiDocument } from './configuration/open-api.document';
import { notFoundMiddleware } from './middlewares/not-found.middleware';
import { normalizeRequestUrlMiddleware } from './middlewares/normalize-request-url.middleware';
import { createUnexpectedErrorMiddleware } from './middlewares/unexpected-error.middleware';
import { ApiRuntimeContext } from './runtime/api-runtime';
import { OperationsApiSettings } from './settings/operations-api.settings';

export interface ApiProgramOptions {
  readonly api?: OperationsApi;
}

const swaggerUiServeFiles = swaggerUi.serveFiles as unknown as (
  swaggerDoc?: object,
  options?: object,
) => RequestHandler[];

const swaggerUiSetup = swaggerUi.setup as unknown as (
  swaggerDoc?: object,
  options?: object,
) => RequestHandler;

const registerRoutes = RegisterRoutes as unknown as (
  application: Application,
) => void;

export class OperationsApi {
  public constructor(
    private readonly authTokenVerifier: AuthTokenVerifierInterface,
    private readonly statisticsManager: JobRunStatisticsManagerInterface,
    private readonly healthCheckManager: HealthCheckManagerInterface,
    private readonly logger: StructuredLogger,
  ) {}

  public static createContainer(): Container {
    const container = new Container();

    CoreModule.register(container);
    InfrastructureModule.register(container);
    ApiModule.register(container);

    return container;
  }

  public static create(): OperationsApi {
    return OperationsApi.createContainer().get<OperationsApi>(
      ApiModule.OperationsApi,
    );
  }

  public static createHandler(
    options: ApiProgramOptions = {},
  ): Application {
    const handler = express();
    let application: Application | null = null;

    handler.use((request, response, next): void => {
      application ??= (
        options.api ?? OperationsApi.create()
      ).createApplication();
      application(request, response, next);
    });

    return handler;
  }

  public static createFunction(options: ApiProgramOptions = {}) {
    return onRequest(
      {
        maxInstances: OperationsApiSettings.maxInstances,
        region: OperationsApiSettings.region,
        timeoutSeconds: OperationsApiSettings.timeoutSeconds,
      },
      OperationsApi.createHandler(options),
    );
  }

  public createApplication(): Application {
    const application = express();

    ApiRuntimeContext.attach(application, this.runtime);
    application.use(normalizeRequestUrlMiddleware);
    application.get('/openapi.json', this.serveOpenApiDocument);
    application.use(
      '/docs',
      ...swaggerUiServeFiles(undefined, {
        customSiteTitle: 'Operations API Docs',
        swaggerOptions: {
          persistAuthorization: true,
        },
        swaggerUrl: './openapi.json',
      }),
      swaggerUiSetup(undefined, {
        customSiteTitle: 'Operations API Docs',
        swaggerOptions: {
          persistAuthorization: true,
        },
        swaggerUrl: './openapi.json',
      }),
    );
    registerRoutes(application);

    application.use(notFoundMiddleware);
    application.use(createUnexpectedErrorMiddleware(this.logger));

    return application;
  }

  private readonly serveOpenApiDocument = (
    request: express.Request,
    response: express.Response,
  ): void => {
    response
      .status(200)
      .json(OpenApiDocument.create(this.createOpenApiServerUrl(request)));
  };

  private createOpenApiServerUrl(request: express.Request): string {
    const requestUrl = this.readRequestUrl(request).trim();
    const withoutOpenApiDocumentPath = requestUrl.replace(
      /\/openapi\.json$/,
      '',
    );

    if (withoutOpenApiDocumentPath.length === 0) {
      return '/';
    }

    return withoutOpenApiDocumentPath;
  }

  private readRequestUrl(request: express.Request): string {
    if (typeof request.originalUrl === 'string') {
      return request.originalUrl;
    }

    return request.url;
  }

  private get runtime() {
    return ApiRuntimeContext.create(
      this.authTokenVerifier,
      this.statisticsManager,
      this.healthCheckManager,
      this.logger,
    );
  }
}
