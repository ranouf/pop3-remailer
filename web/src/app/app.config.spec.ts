import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { appConfig } from './app.config';
import { AuthSessionService } from './core/auth/auth-session.service';

describe('appConfig', () => {
  it('registers the application providers', () => {
    expect(appConfig.providers).toBeDefined();
    expect(appConfig.providers?.length ?? 0).toBeGreaterThan(0);
  });

  it('runs the app initializer through AuthSessionService', async () => {
    const initializeMock = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        ...(appConfig.providers ?? []),
        {
          provide: AuthSessionService,
          useValue: {
            initialize: initializeMock,
          },
        },
      ],
    });

    const injector = TestBed.inject(EnvironmentInjector);

    await runInInjectionContext(injector, async () => {
      for (const provider of appConfig.providers ?? []) {
        if (
          typeof provider === 'object' &&
          provider !== null &&
          'provide' in provider &&
          String(provider.provide).includes('APP_INITIALIZER')
        ) {
          const initialize = (provider as { useValue: () => Promise<void> }).useValue;
          await initialize();
        }
      }
    });

    expect(initializeMock).toHaveBeenCalledTimes(1);
  });
});
