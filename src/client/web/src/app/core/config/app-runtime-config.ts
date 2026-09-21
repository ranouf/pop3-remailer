import type { FirebaseOptions } from 'firebase/app';

export interface AppRuntimeConfig {
  readonly apiBaseUrl: string;
  readonly appName: string;
  readonly authEmulatorUrl: string | null;
  readonly firebaseConfig: FirebaseOptions | null;
}
