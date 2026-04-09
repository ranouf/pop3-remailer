import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { lastValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthSessionService } from '../auth/auth-session.service';
import { authTokenInterceptor } from './auth-token.interceptor';

describe('authTokenInterceptor', () => {
  it('adds the bearer token when one is available', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthSessionService,
          useValue: {
            getAccessToken: vi.fn().mockResolvedValue('token-123'),
            handleForbiddenApiAccess: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: Router,
          useValue: {
            navigateByUrl: vi.fn().mockResolvedValue(true),
          },
        },
      ],
    });

    const request = new HttpRequest('GET', '/statistics');
    const next = vi.fn((nextRequest: HttpRequest<unknown>) =>
      of(new HttpResponse({ body: nextRequest })),
    );

    const response = (await TestBed.runInInjectionContext(() =>
      lastValueFrom(authTokenInterceptor(request, next)),
    )) as HttpResponse<HttpRequest<unknown>>;

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.body!.headers.get('Authorization')).toBe('Bearer token-123');
  });

  it('keeps the request unchanged when no token is available', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthSessionService,
          useValue: {
            getAccessToken: vi.fn().mockResolvedValue(null),
            handleForbiddenApiAccess: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: Router,
          useValue: {
            navigateByUrl: vi.fn().mockResolvedValue(true),
          },
        },
      ],
    });

    const request = new HttpRequest('GET', '/healthcheck');
    const next = vi.fn((nextRequest: HttpRequest<unknown>) =>
      of(new HttpResponse({ body: nextRequest })),
    );

    const response = (await TestBed.runInInjectionContext(() =>
      lastValueFrom(authTokenInterceptor(request, next)),
    )) as HttpResponse<HttpRequest<unknown>>;

    expect(response.body!).toBe(request);
  });

  it('signs out and redirects to login when the API returns forbidden', async () => {
    const handleForbiddenApiAccessMock = vi.fn().mockResolvedValue(undefined);
    const navigateByUrlMock = vi.fn().mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthSessionService,
          useValue: {
            getAccessToken: vi.fn().mockResolvedValue('token-123'),
            handleForbiddenApiAccess: handleForbiddenApiAccessMock,
          },
        },
        {
          provide: Router,
          useValue: {
            navigateByUrl: navigateByUrlMock,
          },
        },
      ],
    });

    const request = new HttpRequest('GET', '/statistics');
    const next = vi.fn(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            url: '/statistics',
          }),
      ),
    );

    await expect(
      TestBed.runInInjectionContext(() => lastValueFrom(authTokenInterceptor(request, next))),
    ).rejects.toBeInstanceOf(HttpErrorResponse);

    expect(handleForbiddenApiAccessMock).toHaveBeenCalledTimes(1);
    expect(navigateByUrlMock).toHaveBeenCalledWith('/login');
  });
});
