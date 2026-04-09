import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { AppRuntimeConfigService } from '../../core/config/app-runtime-config.service';
import { LoginPageComponent } from './login-page.component';

describe('LoginPageComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the Firebase login flow', async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthSessionService,
          useValue: {
            error: signal<string | null>(null).asReadonly(),
            firebaseEnabled: signal(false).asReadonly(),
            firebaseUser: signal(null).asReadonly(),
            isAuthenticated: signal(false).asReadonly(),
            signInWithGoogle: vi.fn().mockResolvedValue(undefined),
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

    const fixture = TestBed.createComponent(LoginPageComponent);

    fixture.detectChanges();
    await fixture.whenStable();

    const html = fixture.nativeElement as HTMLElement;

    expect(html.textContent).toContain('Sign in to the operations dashboard');
    expect(html.textContent).toContain('Firebase auth is unavailable in this environment');
    expect(html.textContent).not.toContain('API token');
    expect(html.textContent).not.toContain('Or use a bearer token');
  });

  it('redirects immediately when an authenticated session is already active', async () => {
    const navigateByUrlMock = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthSessionService,
          useValue: {
            error: signal<string | null>('Session expired').asReadonly(),
            firebaseEnabled: signal(true).asReadonly(),
            firebaseUser: signal({
              email: 'source@example.com',
              uid: 'firebase-user',
            }).asReadonly(),
            isAuthenticated: signal(true).asReadonly(),
            signInWithGoogle: vi.fn().mockResolvedValue(undefined),
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

    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockImplementation(navigateByUrlMock);

    const fixture = TestBed.createComponent(LoginPageComponent);

    fixture.detectChanges();
    await fixture.whenStable();

    const html = fixture.nativeElement as HTMLElement;

    expect(navigateByUrlMock).toHaveBeenCalledWith('/dashboard');
    expect(html.textContent).toContain('Session expired');
    expect(html.textContent).toContain('Continue with Google');
  });

  it('delegates Google sign-in when Firebase auth is enabled', async () => {
    const signInWithGoogleMock = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthSessionService,
          useValue: {
            error: signal<string | null>(null).asReadonly(),
            firebaseEnabled: signal(true).asReadonly(),
            firebaseUser: signal(null).asReadonly(),
            isAuthenticated: signal(false).asReadonly(),
            signInWithGoogle: signInWithGoogleMock,
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

    const fixture = TestBed.createComponent(LoginPageComponent);

    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance as LoginPageComponent & {
      signInWithGoogle(): Promise<void>;
    };

    await component.signInWithGoogle();

    expect(signInWithGoogleMock).toHaveBeenCalledTimes(1);
  });

  it('renders the connected Firebase user state when a Firebase session exists', async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthSessionService,
          useValue: {
            error: signal<string | null>(null).asReadonly(),
            firebaseEnabled: signal(true).asReadonly(),
            firebaseUser: signal({
              email: null,
              uid: 'firebase-user',
            }).asReadonly(),
            isAuthenticated: signal(false).asReadonly(),
            signInWithGoogle: vi.fn().mockResolvedValue(undefined),
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

    const fixture = TestBed.createComponent(LoginPageComponent);

    fixture.detectChanges();
    await fixture.whenStable();

    const html = fixture.nativeElement as HTMLElement;

    expect(html.textContent).toContain('Connected as firebase-user.');
  });
});
