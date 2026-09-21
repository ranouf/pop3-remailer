import type { JobRunStatisticsManagerInterface } from '../../../core/job-run-statistics';
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
import { JobRunStatisticsDto } from './dtos';

@Route('statistics')
@Tags('Operations')
export class GetStatisticsController extends Controller {
  public constructor(
    private readonly manager: JobRunStatisticsManagerInterface,
  ) {
    super();
  }

  @Get()
  @Security('firebaseBearerAuth')
  @SuccessResponse('200', 'OK')
  @Response<ErrorResponseDto>(401, 'Unauthorized')
  @Response<ErrorResponseDto>(403, 'Forbidden')
  public async execute(): Promise<JobRunStatisticsDto> {
    return JobRunStatisticsDto.fromDomain(await this.manager.getStatistics());
  }
}
