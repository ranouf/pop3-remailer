import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AppRuntimeConfigService } from '../config/app-runtime-config.service';
import { OperationsApiService } from './operations-api.service';

describe('OperationsApiService', () => {
  it('calls the healthcheck endpoint with the configured base URL', async () => {
    const getMock = vi.fn().mockReturnValue(of({ overallStatus: 'healthy' }));

    TestBed.configureTestingModule({
      providers: [
        OperationsApiService,
        {
          provide: HttpClient,
          useValue: {
            get: getMock,
          },
        },
        {
          provide: AppRuntimeConfigService,
          useValue: {
            load: vi.fn().mockResolvedValue({
              apiBaseUrl: 'https://example.com/api',
            }),
          },
        },
      ],
    });

    const service = TestBed.inject(OperationsApiService);

    await new Promise<void>((resolve) => {
      service.getHealthcheck().subscribe(() => resolve());
    });

    expect(getMock).toHaveBeenCalledWith('https://example.com/api/healthcheck');
  });

  it('calls the statistics endpoint with the configured base URL', async () => {
    const getMock = vi.fn().mockReturnValue(of({ generatedAt: '2026-04-08T00:00:00.000Z' }));

    TestBed.configureTestingModule({
      providers: [
        OperationsApiService,
        {
          provide: HttpClient,
          useValue: {
            get: getMock,
          },
        },
        {
          provide: AppRuntimeConfigService,
          useValue: {
            load: vi.fn().mockResolvedValue({
              apiBaseUrl: '',
            }),
          },
        },
      ],
    });

    const service = TestBed.inject(OperationsApiService);

    await new Promise<void>((resolve) => {
      service.getStatistics().subscribe(() => resolve());
    });

    expect(getMock).toHaveBeenCalledWith('/statistics');
  });
});
