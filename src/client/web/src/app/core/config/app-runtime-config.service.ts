import { Injectable, signal } from '@angular/core';
import type { FirebaseOptions } from 'firebase/app';
import type { AppRuntimeConfig } from './app-runtime-config';

interface AppRuntimeConfigSource {
  readonly apiBaseUrl?: string;
  readonly appName?: string;
  readonly authEmulatorUrl?: string | null;
  readonly firebaseConfig?: FirebaseOptions | null;
}

const DEFAULT_CONFIG: AppRuntimeConfig = {
  apiBaseUrl: '',
  appName: 'POP3 Remailer',
  authEmulatorUrl: null,
  firebaseConfig: null,
};

@Injectable({ providedIn: 'root' })
export class AppRuntimeConfigService {
  private readonly configState = signal<AppRuntimeConfig>(DEFAULT_CONFIG);
  private initializationPromise: Promise<AppRuntimeConfig> | null = null;

  public readonly config = this.configState.asReadonly();

  public load(): Promise<AppRuntimeConfig> {
    this.initializationPromise ??= this.loadInternal();

    return this.initializationPromise;
  }

  private async loadInternal(): Promise<AppRuntimeConfig> {
    const source = await this.readAppConfigSource();
    const firebaseConfig =
      source.firebaseConfig === undefined
        ? await this.readFirebaseHostingConfig()
        : source.firebaseConfig;
    const config: AppRuntimeConfig = {
      apiBaseUrl: normalizeApiBaseUrl(source.apiBaseUrl),
      appName: source.appName ?? DEFAULT_CONFIG.appName,
      authEmulatorUrl: normalizeOptionalUrl(source.authEmulatorUrl),
      firebaseConfig,
    };

    this.configState.set(config);

    return config;
  }

  private async readAppConfigSource(): Promise<AppRuntimeConfigSource> {
    try {
      const response = await fetch('/app-config.json', { cache: 'no-store' });

      if (!response.ok) {
        return {};
      }

      return parseAppConfigSource(await response.json());
    } catch {
      return {};
    }
  }

  private async readFirebaseHostingConfig(): Promise<FirebaseOptions | null> {
    try {
      const response = await fetch('/__/firebase/init.json', {
        cache: 'no-store',
      });

      if (!response.ok) {
        return null;
      }

      return parseFirebaseOptions(await response.json());
    } catch {
      return null;
    }
  }
}

function normalizeApiBaseUrl(value: string | undefined): string {
  if (value === undefined || value.trim().length === 0) {
    return '';
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function parseAppConfigSource(value: unknown): AppRuntimeConfigSource {
  if (!isRecord(value)) {
    return {};
  }

  return {
    apiBaseUrl: typeof value['apiBaseUrl'] === 'string' ? value['apiBaseUrl'] : undefined,
    appName: typeof value['appName'] === 'string' ? value['appName'] : undefined,
    authEmulatorUrl:
      typeof value['authEmulatorUrl'] === 'string' || value['authEmulatorUrl'] === null
        ? (value['authEmulatorUrl'] as string | null)
        : undefined,
    firebaseConfig:
      Object.hasOwn(value, 'firebaseConfig') || 'firebaseConfig' in value
        ? parseFirebaseOptions(value['firebaseConfig'])
        : undefined,
  };
}

function normalizeOptionalUrl(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  return trimmedValue.endsWith('/') ? trimmedValue.slice(0, -1) : trimmedValue;
}

function parseFirebaseOptions(value: unknown): FirebaseOptions | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const apiKey = readString(value, 'apiKey');
  const appId = readString(value, 'appId');
  const authDomain = readString(value, 'authDomain');
  const messagingSenderId = readString(value, 'messagingSenderId');
  const projectId = readString(value, 'projectId');

  if (
    apiKey === null ||
    appId === null ||
    authDomain === null ||
    messagingSenderId === null ||
    projectId === null
  ) {
    return null;
  }

  return {
    apiKey,
    appId,
    authDomain,
    messagingSenderId,
    projectId,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: Record<string, unknown>, key: string): string | null {
  return typeof value[key] === 'string' ? value[key] : null;
}
