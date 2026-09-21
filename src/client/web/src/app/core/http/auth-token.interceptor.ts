import { inject } from '@angular/core';
import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthSessionService } from '../auth/auth-session.service';

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const authSession = inject(AuthSessionService);
  const router = inject(Router);

  return from(authSession.getAccessToken()).pipe(
    switchMap((token) =>
      next(
        token === null
          ? request
          : request.clone({
              setHeaders: {
                Authorization: `Bearer ${token}`,
              },
            }),
      ),
    ),
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 403) {
        return throwError(() => error);
      }

      return from(authSession.handleForbiddenApiAccess()).pipe(
        switchMap(() => from(router.navigateByUrl('/login'))),
        switchMap(() => throwError(() => error)),
      );
    }),
  );
};
