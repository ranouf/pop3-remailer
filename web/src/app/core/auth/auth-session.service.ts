import { inject, Injectable, computed, signal } from '@angular/core';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { FirebaseAppService } from '../firebase/firebase-app.service';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly firebaseApp = inject(FirebaseAppService);
  private readonly errorState = signal<string | null>(null);
  private readonly firebaseEnabledState = signal(false);
  private readonly firebaseUserState = signal<User | null>(null);
  private readonly initializedState = signal(false);
  private initializationPromise: Promise<void> | null = null;

  public readonly error = this.errorState.asReadonly();
  public readonly firebaseEnabled = this.firebaseEnabledState.asReadonly();
  public readonly firebaseUser = this.firebaseUserState.asReadonly();
  public readonly initialized = this.initializedState.asReadonly();
  public readonly isAuthenticated = computed(() => this.firebaseUserState() !== null);

  public initialize(): Promise<void> {
    this.initializationPromise ??= this.initializeInternal();

    return this.initializationPromise;
  }

  public async getAccessToken(): Promise<string | null> {
    await this.initialize();

    const user = this.firebaseUserState();

    if (user === null) {
      return null;
    }

    return user.getIdToken();
  }

  public async signInWithGoogle(): Promise<void> {
    this.errorState.set(null);

    try {
      await this.initialize();
      await this.firebaseApp.signInWithGoogle();
    } catch (error) {
      this.errorState.set(readErrorMessage(error));
      throw error;
    }
  }

  public async signOut(): Promise<void> {
    this.errorState.set(null);
    await this.firebaseApp.signOut();
  }

  public async handleForbiddenApiAccess(): Promise<void> {
    this.firebaseUserState.set(null);

    try {
      await this.firebaseApp.signOut();
    } catch {
      // Ignore sign-out issues when access is denied by the backend.
    }

    this.errorState.set(
      'This Google account is not authorized to access the operations dashboard.',
    );
  }

  private async initializeInternal(): Promise<void> {
    await this.firebaseApp.initialize();

    const auth = this.firebaseApp.getAuth();

    if (auth === null) {
      this.initializedState.set(true);
      return;
    }

    this.firebaseEnabledState.set(true);

    await new Promise<void>((resolve) => {
      onAuthStateChanged(auth, (user) => {
        this.firebaseUserState.set(user);

        if (!this.initializedState()) {
          this.initializedState.set(true);
          resolve();
        }
      });
    });
  }
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected authentication error occurred.';
}
