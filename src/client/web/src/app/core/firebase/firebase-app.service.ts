import { inject, Injectable } from '@angular/core';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { AppRuntimeConfigService } from '../config/app-runtime-config.service';

@Injectable({ providedIn: 'root' })
export class FirebaseAppService {
  private readonly runtimeConfig = inject(AppRuntimeConfigService);
  private auth: Auth | null = null;
  private firebaseApp: FirebaseApp | null = null;
  private initializationPromise: Promise<void> | null = null;

  public initialize(): Promise<void> {
    this.initializationPromise ??= this.initializeInternal();

    return this.initializationPromise;
  }

  public getAuth(): Auth | null {
    return this.auth;
  }

  public async signInWithGoogle(): Promise<void> {
    const auth = this.requireAuth();
    const provider = new GoogleAuthProvider();

    provider.setCustomParameters({
      prompt: 'select_account',
    });

    await signInWithPopup(auth, provider);
  }

  public async signOut(): Promise<void> {
    const auth = this.getAuth();

    if (auth === null) {
      return;
    }

    await signOut(auth);
  }

  private async initializeInternal(): Promise<void> {
    const config = await this.runtimeConfig.load();

    if (config.firebaseConfig === null) {
      return;
    }

    this.firebaseApp = initializeApp(config.firebaseConfig);
    this.auth = getAuth(this.firebaseApp);

    if (config.authEmulatorUrl !== null) {
      connectAuthEmulator(this.auth, config.authEmulatorUrl, {
        disableWarnings: true,
      });
    }
  }

  private requireAuth(): Auth {
    const auth = this.getAuth();

    if (auth === null) {
      throw new Error(
        'Firebase authentication is unavailable because no Firebase web config could be loaded.',
      );
    }

    return auth;
  }
}
