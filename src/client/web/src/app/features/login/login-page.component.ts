import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { AppRuntimeConfigService } from '../../core/config/app-runtime-config.service';

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent {
  private readonly router = inject(Router);
  private readonly runtimeConfig = inject(AppRuntimeConfigService);

  protected readonly appName = computed(() => this.runtimeConfig.config().appName);
  protected readonly authSession = inject(AuthSessionService);
  protected readonly submitting = signal(false);

  public constructor() {
    effect(() => {
      if (this.authSession.isAuthenticated()) {
        void this.router.navigateByUrl('/dashboard');
      }
    });
  }

  protected async signInWithGoogle(): Promise<void> {
    this.submitting.set(true);

    try {
      await this.authSession.signInWithGoogle();
    } finally {
      this.submitting.set(false);
    }
  }
}
