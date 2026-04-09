import type { HealthCheckManagerInterface } from '../../../core/health-check/health-check-manager.interface';
import {
  Controller,
  Get,
  Response,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from 'tsoa';

import type { ErrorResponseDto } from '../../dtos';
import { HealthCheckReportDto } from './dtos';

@Route('healthcheck')
@Tags('Operations')
export class GetHealthChecksController extends Controller {
  public constructor(private readonly manager: HealthCheckManagerInterface) {
    super();
  }

  @Get()
  @Security('firebaseBearerAuth')
  @SuccessResponse('200', 'OK')
  @Response<ErrorResponseDto>(401, 'Unauthorized')
  @Response<ErrorResponseDto>(403, 'Forbidden')
  public async execute(): Promise<HealthCheckReportDto> {
    return HealthCheckReportDto.fromDomain(await this.manager.execute());
  }
}
