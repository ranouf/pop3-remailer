import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { firstValueFrom, forkJoin } from 'rxjs';
import { OperationsApiService } from '../../core/api/operations-api.service';
import type {
  HealthCheckReportResponse,
  JobRunStatisticsDailyPointResponse,
  JobRunStatisticsResponse,
} from '../../core/api/operations-api.models';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { AppRuntimeConfigService } from '../../core/config/app-runtime-config.service';

@Component({
  selector: 'app-dashboard-page',
  imports: [BaseChartDirective, DatePipe, DecimalPipe, NgClass],
  templateUrl: './dashboard-page.component.html',
})
export class DashboardPageComponent {
  private static readonly expensiveThreshold = 0.66;
  private static readonly warningThreshold = 0.4;
  private static readonly detectedColor = '#38bdf8';
  private static readonly transferredColor = '#34d399';
  private static readonly failedColor = '#fb7185';
  private static readonly durationColor = '#c084fc';
  private readonly api = inject(OperationsApiService);
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly runtimeConfig = inject(AppRuntimeConfigService);

  protected readonly appName = computed(() => this.runtimeConfig.config().appName);
  protected readonly dailyChartData = computed<ChartData<'line'>>(() => {
    const points = this.chronologicalDailyPoints();

    return {
      datasets: [
        {
          borderColor: DashboardPageComponent.detectedColor,
          data: points.map((point) => point.detectedCount),
          label: 'Detected',
          pointBackgroundColor: points.map((point) =>
            this.costPointColor(this.getCostLevel(point)),
          ),
          pointBorderColor: DashboardPageComponent.detectedColor,
          pointHoverRadius: 6,
          pointRadius: 4,
          tension: 0.28,
          yAxisID: 'counts',
        },
        {
          borderColor: DashboardPageComponent.transferredColor,
          data: points.map((point) => point.transferredCount),
          label: 'Transferred',
          pointBackgroundColor: points.map((point) =>
            this.costPointColor(this.getCostLevel(point)),
          ),
          pointBorderColor: DashboardPageComponent.transferredColor,
          pointHoverRadius: 6,
          pointRadius: 4,
          tension: 0.28,
          yAxisID: 'counts',
        },
        {
          borderColor: DashboardPageComponent.failedColor,
          data: points.map((point) => point.failedCount),
          label: 'Error',
          pointBackgroundColor: points.map((point) =>
            this.costPointColor(this.getCostLevel(point)),
          ),
          pointBorderColor: DashboardPageComponent.failedColor,
          pointHoverRadius: 6,
          pointRadius: 4,
          tension: 0.28,
          yAxisID: 'counts',
        },
        {
          borderColor: DashboardPageComponent.durationColor,
          data: points.map((point) => this.toAverageSeconds(point.averageDurationMs)),
          label: 'Duration',
          pointBackgroundColor: points.map((point) =>
            this.costPointColor(this.getCostLevel(point)),
          ),
          pointBorderColor: DashboardPageComponent.durationColor,
          pointHoverRadius: 6,
          pointRadius: 4,
          tension: 0.28,
          yAxisID: 'duration',
        },
      ],
      labels: points.map((point) =>
        new Date(point.date).toLocaleDateString('en-CA', {
          day: 'numeric',
          month: 'short',
        }),
      ),
    };
  });
  protected readonly dailyChartOptions: ChartOptions<'line'> = {
    animation: false,
    interaction: {
      intersect: false,
      mode: 'index',
    },
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#cbd5e1',
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(2, 6, 23, 0.92)',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(148, 163, 184, 0.25)',
        borderWidth: 1,
        callbacks: {
          afterBody: (items) => {
            const point = this.getPointForTooltip(items);

            if (point === null) {
              return [];
            }

            return [point.runCount === 1 ? '1 run' : `${point.runCount} runs`];
          },
          beforeBody: (items) => {
            const point = this.getPointForTooltip(items);

            if (point === null) {
              return [];
            }

            return [
              `${point.detectedCount} detected`,
              `${point.transferredCount} transferred`,
              `${point.failedCount} error`,
              `avg ${this.toAverageSeconds(point.averageDurationMs)}s`,
            ];
          },
          label: () => '',
          title: (items) => {
            const point = this.getPointForTooltip(items);

            if (point === null) {
              return '';
            }

            return new Date(point.date).toLocaleDateString('en-CA', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
          },
        },
        displayColors: false,
      },
    },
    scales: {
      counts: {
        beginAtZero: true,
        grid: {
          color: 'rgba(148, 163, 184, 0.14)',
        },
        ticks: {
          color: '#94a3b8',
          precision: 0,
        },
      },
      duration: {
        beginAtZero: true,
        grid: {
          drawOnChartArea: false,
        },
        position: 'right',
        ticks: {
          color: '#c4b5fd',
          precision: 0,
          callback: (value) => `${value}s`,
        },
      },
      x: {
        grid: {
          color: 'rgba(148, 163, 184, 0.08)',
        },
        ticks: {
          color: '#94a3b8',
        },
      },
    },
  };
  protected readonly error = signal<string | null>(null);
  protected readonly healthcheck = signal<HealthCheckReportResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly statistics = signal<JobRunStatisticsResponse | null>(null);
  protected readonly listedDailyPoints = computed(() =>
    [...(this.statistics()?.dailyPoints ?? [])]
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
      .map((point) => ({
        costLevel: this.getCostLevel(point),
        costScore: Math.round(this.calculateCostScore(point) * 100),
        point,
      })),
  );

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

  protected costBadgeClass(level: DashboardResourceCostLevel): Record<string, boolean> {
    return {
      'bg-emerald-400/15 text-emerald-200': level === 'efficient',
      'bg-amber-400/15 text-amber-200': level === 'watch',
      'bg-rose-400/15 text-rose-100': level === 'expensive',
    };
  }

  protected costRowClass(level: DashboardResourceCostLevel): Record<string, boolean> {
    return {
      'border-emerald-400/15 bg-emerald-400/5': level === 'efficient',
      'border-amber-400/20 bg-amber-400/8': level === 'watch',
      'border-rose-400/25 bg-rose-400/10': level === 'expensive',
    };
  }

  protected costLabel(level: DashboardResourceCostLevel): string {
    if (level === 'expensive') {
      return 'High resource cost';
    }

    if (level === 'watch') {
      return 'Watch usage';
    }

    return 'Efficient day';
  }

  protected costPointColor(level: DashboardResourceCostLevel): string {
    if (level === 'expensive') {
      return '#fb7185';
    }

    if (level === 'watch') {
      return '#fbbf24';
    }

    return '#34d399';
  }

  protected statusClass(status: string): Record<string, boolean> {
    const normalizedStatus = status.toLowerCase();

    return {
      'bg-emerald-400/20 text-emerald-200': normalizedStatus === 'completed',
      'bg-amber-400/20 text-amber-200': normalizedStatus !== 'completed',
    };
  }
  protected async signOut(): Promise<void> {
    await this.authSession.signOut();
    await this.router.navigateByUrl('/login');
  }

  private chronologicalDailyPoints(): readonly JobRunStatisticsDailyPointResponse[] {
    return [...(this.statistics()?.dailyPoints ?? [])].sort(
      (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime(),
    );
  }

  private calculateCostScore(point: JobRunStatisticsDailyPointResponse): number {
    const allPoints = this.statistics()?.dailyPoints ?? [];
    const maxDetectedCount = Math.max(
      1,
      ...allPoints.map((dailyPoint) => dailyPoint.detectedCount),
    );
    const maxAverageDurationMs = Math.max(
      1,
      ...allPoints.map((dailyPoint) => dailyPoint.averageDurationMs ?? 0),
    );
    const detectedWeight = point.detectedCount / maxDetectedCount;
    const failedWeight = point.failedCount > 0 ? Math.min(1, point.failedCount / 3) : 0;
    const durationWeight =
      point.averageDurationMs === null ? 0 : point.averageDurationMs / maxAverageDurationMs;

    return detectedWeight * 0.45 + durationWeight * 0.35 + failedWeight * 0.2;
  }

  private getCostLevel(point: JobRunStatisticsDailyPointResponse): DashboardResourceCostLevel {
    const score = this.calculateCostScore(point);

    if (score >= DashboardPageComponent.expensiveThreshold) {
      return 'expensive';
    }

    if (score >= DashboardPageComponent.warningThreshold) {
      return 'watch';
    }

    return 'efficient';
  }

  private getPointForTooltip(
    items: TooltipItem<'line'>[],
  ): JobRunStatisticsDailyPointResponse | null {
    const index = items[0]?.dataIndex;
    const points = this.chronologicalDailyPoints();

    if (index === undefined) {
      return null;
    }

    return points[index] ?? null;
  }

  private toAverageSeconds(durationMs: number | null): number {
    if (durationMs === null) {
      return 0;
    }

    return Math.round(durationMs / 100) / 10;
  }
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'The dashboard could not load the latest data.';
}

type DashboardResourceCostLevel = 'efficient' | 'expensive' | 'watch';
