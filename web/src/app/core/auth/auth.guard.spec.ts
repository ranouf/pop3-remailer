import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AuthSessionService } from './auth-session.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  it('allows authenticated users', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthSessionService,
          useValue: {
            initialize: vi.fn().mockResolvedValue(undefined),
            isAuthenticated: vi.fn().mockReturnValue(true),
          },
        },
        {
          provide: Router,
          useValue: {
            createUrlTree: vi.fn(),
          },
        },
      ],
    });

    const result = await TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(result).toBe(true);
  });

  it('redirects anonymous users to login', async () => {
    const redirectTree = {
      redirected: true,
    };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthSessionService,
          useValue: {
            initialize: vi.fn().mockResolvedValue(undefined),
            isAuthenticated: vi.fn().mockReturnValue(false),
          },
        },
        {
          provide: Router,
          useValue: {
            createUrlTree: vi.fn().mockReturnValue(redirectTree),
          },
        },
      ],
    });

    const result = await TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(result).toBe(redirectTree);
  });
});
