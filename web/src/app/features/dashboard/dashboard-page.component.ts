import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { OperationsApiService } from '../../core/api/operations-api.service';
import type {
  HealthCheckReportResponse,
  JobRunStatisticsResponse,
} from '../../core/api/operations-api.models';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { AppRuntimeConfigService } from '../../core/config/app-runtime-config.service';

@Component({
  selector: 'app-dashboard-page',
  imports: [DatePipe, DecimalPipe, NgClass],
  templateUrl: './dashboard-page.component.html',
})
export class DashboardPageComponent {
  private readonly api = inject(OperationsApiService);
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly runtimeConfig = inject(AppRuntimeConfigService);

  protected readonly appName = computed(() => this.runtimeConfig.config().appName);
  protected readonly error = signal<string | null>(null);
  protected readonly healthcheck = signal<HealthCheckReportResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly statistics = signal<JobRunStatisticsResponse | null>(null);
  private readonly maxDetectedCount = computed(() => {
    const values = this.statistics()?.dailyPoints.map((point) => point.detectedCount) ?? [];

    return Math.max(1, ...values);
  });

  public constructor() {
    void this.reload();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [statistics, healthcheck] = await firstValueFrom(
        forkJoin([this.api.getStatistics(), this.api.getHealthcheck()]),
      );

      this.statistics.set(statistics);
      this.healthcheck.set(healthcheck);
    } catch (error) {
      this.error.set(readErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected formatDuration(durationMs: number | null | undefined): string {
    if (durationMs === null || durationMs === undefined) {
      return 'n/a';
    }

    if (durationMs < 1_000) {
      return `${durationMs} ms`;
    }

    if (durationMs < 60_000) {
      return `${Math.round(durationMs / 100) / 10} s`;
    }

    return `${Math.round((durationMs / 60_000) * 10) / 10} min`;
  }

  protected statusClass(status: string): Record<string, boolean> {
    const normalizedStatus = status.toLowerCase();

    return {
      'bg-emerald-400/20 text-emerald-200': normalizedStatus === 'completed',
      'bg-amber-400/20 text-amber-200': normalizedStatus !== 'completed',
    };
  }

  protected toPercentage(value: number): number {
    return Math.max(8, (value / this.maxDetectedCount()) * 100);
  }

  protected async signOut(): Promise<void> {
    await this.authSession.signOut();
    await this.router.navigateByUrl('/login');
  }
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'The dashboard could not load the latest data.';
}
