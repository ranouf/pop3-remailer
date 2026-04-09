import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OperationsApiService } from '../../core/api/operations-api.service';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { AppRuntimeConfigService } from '../../core/config/app-runtime-config.service';
import { DashboardPageComponent } from './dashboard-page.component';

describe('DashboardPageComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the statistics and healthcheck data', async () => {
    const signOutMock = vi.fn().mockResolvedValue(undefined);
    const navigateByUrlMock = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [
        provideCharts(withDefaultRegisterables()),
        {
          provide: OperationsApiService,
          useValue: {
            getHealthcheck: vi.fn().mockReturnValue(
              of({
                checkedAt: '2026-04-08T12:00:00.000Z',
                checks: [
                  {
                    checkedAt: '2026-04-08T12:00:00.000Z',
                    message: 'POP3 reachable',
                    name: 'pop3',
                    status: 'healthy',
                  },
                ],
                overallStatus: 'healthy',
              }),
            ),
            getStatistics: vi.fn().mockReturnValue(
              of({
                dailyPoints: [
                  {
                    averageDurationMs: 3_600,
                    date: '2026-04-07T00:00:00.000Z',
                    detectedCount: 30,
                    failedCount: 4,
                    runCount: 3,
                    transferredCount: 12,
                  },
                  {
                    averageDurationMs: 1_200,
                    date: '2026-04-08T00:00:00.000Z',
                    detectedCount: 12,
                    failedCount: 1,
                    runCount: 2,
                    transferredCount: 10,
                  },
                ],
                generatedAt: '2026-04-08T12:00:00.000Z',
                kpis: {
                  detectedLast24h: 12,
                  failedLast24h: 1,
                  lastError: null,
                  lastRun: null,
                  lastSuccess: null,
                  transferredLast24h: 10,
                },
                recentErrors: [
                  {
                    detectedCount: 12,
                    failedCount: 1,
                    jobId: 'job-2',
                    processedCount: 12,
                    provider: 'Orange',
                    skippedCount: 0,
                    sourceAccountId: 'orange:test@orange.fr',
                    startedAt: '2026-04-08T11:00:00.000Z',
                    status: 'Failed',
                    transferredCount: 10,
                  },
                ],
                recentRuns: [
                  {
                    detectedCount: 12,
                    durationMs: 1_200,
                    failedCount: 0,
                    jobId: 'job-1',
                    processedCount: 12,
                    provider: 'Orange',
                    skippedCount: 0,
                    sourceAccountId: 'orange:test@orange.fr',
                    startedAt: '2026-04-08T10:00:00.000Z',
                    status: 'Completed',
                    transferredCount: 12,
                  },
                ],
              }),
            ),
          },
        },
        {
          provide: AuthSessionService,
          useValue: {
            signOut: signOutMock,
          },
        },
        {
          provide: Router,
          useValue: {
            navigateByUrl: navigateByUrlMock,
          },
        },
        {
          provide: AppRuntimeConfigService,
          useValue: {
            config: signal({
              apiBaseUrl: '',
              appName: 'POP3 Remailer',
              firebaseConfig: null,
            }).asReadonly(),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardPageComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;

    expect(html.textContent).toContain('Transfer statistics');
    expect(html.textContent).toContain('12');
    expect(html.textContent).toContain('healthy');
    expect(html.textContent).toContain('job-1');
    expect(html.textContent).toContain('POP3 reachable');
    expect(html.textContent).toContain('High resource cost');
    expect(html.textContent).toContain('Watch usage');
    expect(html.textContent).toContain('Efficient day');

    const component = fixture.componentInstance as DashboardPageComponent & {
      listedDailyPoints(): readonly {
        readonly point: { readonly date: string };
      }[];
    };

    expect(component.listedDailyPoints()).toHaveLength(2);
    expect(component.listedDailyPoints()[0]?.point.date).toBe('2026-04-08T00:00:00.000Z');
    expect(component.listedDailyPoints()[1]?.point.date).toBe('2026-04-07T00:00:00.000Z');

    const chart = html.querySelector('canvas[aria-label="Daily transfer chart"]');

    expect(chart).not.toBeNull();

    const buttons = Array.from(html.querySelectorAll('button'));
    const signOutButton = buttons.find((button) => button.textContent?.includes('Sign out'));

    expect(signOutButton).toBeDefined();

    signOutButton?.dispatchEvent(new Event('click'));
    await fixture.whenStable();

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(navigateByUrlMock).toHaveBeenCalledWith('/login');
  });

  it('renders the error state when the API cannot be loaded', async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [
        provideCharts(withDefaultRegisterables()),
        {
          provide: OperationsApiService,
          useValue: {
            getHealthcheck: vi
              .fn()
              .mockReturnValue(throwError(() => new Error('Backend unavailable'))),
            getStatistics: vi
              .fn()
              .mockReturnValue(throwError(() => new Error('Backend unavailable'))),
          },
        },
        {
          provide: AuthSessionService,
          useValue: {
            signOut: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: Router,
          useValue: {
            navigateByUrl: vi.fn().mockResolvedValue(true),
          },
        },
        {
          provide: AppRuntimeConfigService,
          useValue: {
            config: signal({
              apiBaseUrl: '',
              appName: 'POP3 Remailer',
              firebaseConfig: null,
            }).asReadonly(),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardPageComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;

    expect(html.textContent).toContain('Backend unavailable');
  });

  it('falls back to the default dashboard error message for non-Error failures', async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [
        provideCharts(withDefaultRegisterables()),
        {
          provide: OperationsApiService,
          useValue: {
            getHealthcheck: vi.fn().mockReturnValue(throwError(() => 'boom')),
            getStatistics: vi.fn().mockReturnValue(throwError(() => 'boom')),
          },
        },
        {
          provide: AuthSessionService,
          useValue: {
            signOut: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: Router,
          useValue: {
            navigateByUrl: vi.fn().mockResolvedValue(true),
          },
        },
        {
          provide: AppRuntimeConfigService,
          useValue: {
            config: signal({
              apiBaseUrl: '',
              appName: 'POP3 Remailer',
              firebaseConfig: null,
            }).asReadonly(),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardPageComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;

    expect(html.textContent).toContain('The dashboard could not load the latest data.');
  });

  it('renders empty-state cards when no statistics are available yet', async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [
        provideCharts(withDefaultRegisterables()),
        {
          provide: OperationsApiService,
          useValue: {
            getHealthcheck: vi.fn().mockReturnValue(
              of({
                checkedAt: '2026-04-08T12:00:00.000Z',
                checks: [],
                overallStatus: 'unknown',
              }),
            ),
            getStatistics: vi.fn().mockReturnValue(
              of({
                dailyPoints: [],
                generatedAt: '2026-04-08T12:00:00.000Z',
                kpis: {
                  detectedLast24h: 0,
                  failedLast24h: 0,
                  lastError: null,
                  lastRun: null,
                  lastSuccess: null,
                  transferredLast24h: 0,
                },
                recentErrors: [],
                recentRuns: [],
              }),
            ),
          },
        },
        {
          provide: AuthSessionService,
          useValue: {
            signOut: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: Router,
          useValue: {
            navigateByUrl: vi.fn().mockResolvedValue(true),
          },
        },
        {
          provide: AppRuntimeConfigService,
          useValue: {
            config: signal({
              apiBaseUrl: '',
              appName: 'POP3 Remailer',
              firebaseConfig: null,
            }).asReadonly(),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardPageComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const component = fixture.componentInstance as DashboardPageComponent & {
      formatDuration(value: number | null | undefined): string;
      statusClass(value: string): Record<string, boolean>;
    };

    expect(html.textContent).toContain('No daily statistics are available yet.');
    expect(html.textContent).toContain('No recent runs yet.');
    expect(html.textContent).toContain('No recent errors were reported.');
    expect(component.formatDuration(null)).toBe('n/a');
    expect(component.formatDuration(500)).toBe('500 ms');
    expect(component.formatDuration(5_000)).toBe('5 s');
    expect(component.formatDuration(120_000)).toBe('2 min');
    expect(component.statusClass('Completed')).toEqual({
      'bg-amber-400/20 text-amber-200': false,
      'bg-emerald-400/20 text-emerald-200': true,
    });
  });

  it('builds chart data, tooltip details, and resource-cost states for daily points', async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [
        provideCharts(withDefaultRegisterables()),
        {
          provide: OperationsApiService,
          useValue: {
            getHealthcheck: vi.fn().mockReturnValue(
              of({
                checkedAt: '2026-04-08T12:00:00.000Z',
                checks: [],
                overallStatus: 'healthy',
              }),
            ),
            getStatistics: vi.fn().mockReturnValue(
              of({
                dailyPoints: [
                  {
                    averageDurationMs: null,
                    date: '2026-04-06T00:00:00.000Z',
                    detectedCount: 1,
                    failedCount: 0,
                    runCount: 1,
                    transferredCount: 1,
                  },
                  {
                    averageDurationMs: 3_000,
                    date: '2026-04-07T00:00:00.000Z',
                    detectedCount: 20,
                    failedCount: 1,
                    runCount: 2,
                    transferredCount: 8,
                  },
                  {
                    averageDurationMs: 6_000,
                    date: '2026-04-08T00:00:00.000Z',
                    detectedCount: 30,
                    failedCount: 4,
                    runCount: 3,
                    transferredCount: 10,
                  },
                ],
                generatedAt: '2026-04-08T12:00:00.000Z',
                kpis: {
                  detectedLast24h: 30,
                  failedLast24h: 4,
                  lastError: null,
                  lastRun: null,
                  lastSuccess: null,
                  transferredLast24h: 10,
                },
                recentErrors: [],
                recentRuns: [],
              }),
            ),
          },
        },
        {
          provide: AuthSessionService,
          useValue: {
            signOut: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: Router,
          useValue: {
            navigateByUrl: vi.fn().mockResolvedValue(true),
          },
        },
        {
          provide: AppRuntimeConfigService,
          useValue: {
            config: signal({
              apiBaseUrl: '',
              appName: 'POP3 Remailer',
              firebaseConfig: null,
            }).asReadonly(),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardPageComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    type DashboardComponentProbe = DashboardPageComponent & {
      costBadgeClass(level: 'efficient' | 'expensive' | 'watch'): Record<string, boolean>;
      costLabel(level: 'efficient' | 'expensive' | 'watch'): string;
      costPointColor(level: 'efficient' | 'expensive' | 'watch'): string;
      costRowClass(level: 'efficient' | 'expensive' | 'watch'): Record<string, boolean>;
      dailyChartData(): {
        datasets: {
          data: number[];
          pointBackgroundColor: string[];
        }[];
        labels: string[];
      };
      dailyChartOptions: {
        plugins?: {
          tooltip?: {
            callbacks?: {
              afterBody?: (items: { dataIndex?: number }[]) => string[];
              beforeBody?: (items: { dataIndex?: number }[]) => string[];
              title?: (items: { dataIndex?: number }[]) => string;
            };
          };
        };
      };
      listedDailyPoints(): {
        costLevel: 'efficient' | 'expensive' | 'watch';
        costScore: number;
        point: { date: string };
      }[];
    };

    const component = fixture.componentInstance as DashboardComponentProbe;
    const listedPoints = component.listedDailyPoints();
    const chartData = component.dailyChartData();
    const tooltipCallbacks = component.dailyChartOptions.plugins?.tooltip?.callbacks;

    expect(listedPoints.map((entry) => entry.costLevel)).toEqual([
      'expensive',
      'watch',
      'efficient',
    ]);
    expect(listedPoints[0]?.costScore).toBeGreaterThan(listedPoints[1]?.costScore ?? 0);
    expect(chartData.labels).toHaveLength(3);
    expect(chartData.datasets[0]?.pointBackgroundColor).toEqual(['#34d399', '#fbbf24', '#fb7185']);
    expect(chartData.datasets[3]?.data).toEqual([0, 3, 6]);
    expect(component.costLabel('expensive')).toBe('High resource cost');
    expect(component.costLabel('watch')).toBe('Watch usage');
    expect(component.costLabel('efficient')).toBe('Efficient day');
    expect(component.costPointColor('expensive')).toBe('#fb7185');
    expect(component.costPointColor('watch')).toBe('#fbbf24');
    expect(component.costPointColor('efficient')).toBe('#34d399');
    expect(component.costBadgeClass('expensive')).toEqual({
      'bg-amber-400/15 text-amber-200': false,
      'bg-emerald-400/15 text-emerald-200': false,
      'bg-rose-400/15 text-rose-100': true,
    });
    expect(component.costRowClass('watch')).toEqual({
      'border-amber-400/20 bg-amber-400/8': true,
      'border-emerald-400/15 bg-emerald-400/5': false,
      'border-rose-400/25 bg-rose-400/10': false,
    });
    expect(tooltipCallbacks?.beforeBody?.([])).toEqual([]);
    expect(tooltipCallbacks?.afterBody?.([])).toEqual([]);
    expect(tooltipCallbacks?.title?.([])).toBe('');
    expect(tooltipCallbacks?.beforeBody?.([{ dataIndex: 2 }])).toEqual([
      '30 detected',
      '10 transferred',
      '4 error',
      'avg 6s',
    ]);
    expect(tooltipCallbacks?.afterBody?.([{ dataIndex: 0 }])).toEqual(['1 run']);
    expect(tooltipCallbacks?.title?.([{ dataIndex: 1 }])).toContain('Apr');
  });
});
