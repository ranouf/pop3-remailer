import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
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
      toPercentage(value: number): number;
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
    expect(component.toPercentage(0)).toBe(8);
  });
});
