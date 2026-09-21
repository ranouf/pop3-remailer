import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRuntimeConfigService } from './app-runtime-config.service';

describe('AppRuntimeConfigService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('returns the default configuration when no config source can be loaded', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);

    fetchMock.mockResolvedValue({
      ok: false,
    } as Response);

    TestBed.configureTestingModule({});

    const service = TestBed.inject(AppRuntimeConfigService);
    const config = await service.load();

    expect(config).toEqual({
      apiBaseUrl: '',
      appName: 'POP3 Remailer',
      authEmulatorUrl: null,
      firebaseConfig: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses the explicit app config and normalizes the API base URL', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);

    fetchMock.mockResolvedValue({
      json: async () => ({
        apiBaseUrl: 'https://example.com/api/',
        appName: 'Operations Portal',
        authEmulatorUrl: 'http://127.0.0.1:9099/',
        firebaseConfig: {
          apiKey: 'api-key',
          appId: 'app-id',
          authDomain: 'example.firebaseapp.com',
          messagingSenderId: 'sender-id',
          projectId: 'project-id',
        },
      }),
      ok: true,
    } as Response);

    TestBed.configureTestingModule({});

    const service = TestBed.inject(AppRuntimeConfigService);
    const config = await service.load();

    expect(config).toEqual({
      apiBaseUrl: 'https://example.com/api',
      appName: 'Operations Portal',
      authEmulatorUrl: 'http://127.0.0.1:9099',
      firebaseConfig: {
        apiKey: 'api-key',
        appId: 'app-id',
        authDomain: 'example.firebaseapp.com',
        messagingSenderId: 'sender-id',
        projectId: 'project-id',
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(service.config()).toEqual(config);
  });

  it('falls back to the Firebase Hosting config when the app config omits it', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);

    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          apiBaseUrl: '/api',
          appName: 'POP3 Remailer',
        }),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          apiKey: 'api-key',
          appId: 'app-id',
          authDomain: 'example.firebaseapp.com',
          messagingSenderId: 'sender-id',
          projectId: 'project-id',
        }),
        ok: true,
      } as Response);

    TestBed.configureTestingModule({});

    const service = TestBed.inject(AppRuntimeConfigService);
    const config = await service.load();

    expect(config.firebaseConfig).toEqual({
      apiKey: 'api-key',
      appId: 'app-id',
      authDomain: 'example.firebaseapp.com',
      messagingSenderId: 'sender-id',
      projectId: 'project-id',
    });
    expect(config.authEmulatorUrl).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null Firebase config when the hosting payload is invalid', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);

    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({}),
        ok: true,
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          apiKey: 'api-key',
        }),
        ok: true,
      } as Response);

    TestBed.configureTestingModule({});

    const service = TestBed.inject(AppRuntimeConfigService);
    const config = await service.load();

    expect(config.firebaseConfig).toBeNull();
  });

  it('returns the default configuration when fetch throws and preserves explicit null Firebase config', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);

    fetchMock.mockRejectedValueOnce(new Error('app-config unavailable')).mockResolvedValueOnce({
      json: async () => ({
        apiBaseUrl: '   ',
        appName: 42,
        firebaseConfig: null,
      }),
      ok: true,
    } as Response);

    TestBed.configureTestingModule({});

    const service = TestBed.inject(AppRuntimeConfigService);
    const firstConfig = await service.load();

    expect(firstConfig).toEqual({
      apiBaseUrl: '',
      appName: 'POP3 Remailer',
      authEmulatorUrl: null,
      firebaseConfig: null,
    });

    TestBed.resetTestingModule();
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        apiBaseUrl: '   ',
        appName: 42,
        firebaseConfig: null,
      }),
      ok: true,
    } as Response);

    const secondService = TestBed.inject(AppRuntimeConfigService);
    const secondConfig = await secondService.load();

    expect(secondConfig).toEqual({
      apiBaseUrl: '',
      appName: 'POP3 Remailer',
      authEmulatorUrl: null,
      firebaseConfig: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
