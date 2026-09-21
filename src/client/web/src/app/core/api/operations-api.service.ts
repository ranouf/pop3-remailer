import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { from, switchMap, type Observable } from 'rxjs';
import { AppRuntimeConfigService } from '../config/app-runtime-config.service';
import type { HealthCheckReportResponse, JobRunStatisticsResponse } from './operations-api.models';

@Injectable({ providedIn: 'root' })
export class OperationsApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfig = inject(AppRuntimeConfigService);

  public getHealthcheck(): Observable<HealthCheckReportResponse> {
    return from(this.runtimeConfig.load()).pipe(
      switchMap((config) =>
        this.httpClient.get<HealthCheckReportResponse>(`${config.apiBaseUrl}/healthcheck`),
      ),
    );
  }

  public getStatistics(): Observable<JobRunStatisticsResponse> {
    return from(this.runtimeConfig.load()).pipe(
      switchMap((config) =>
        this.httpClient.get<JobRunStatisticsResponse>(`${config.apiBaseUrl}/statistics`),
      ),
    );
  }
}
