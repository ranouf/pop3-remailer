import type { gmail_v1 } from 'googleapis';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GmailApiClientFactory } from '../../../../src/infrastructure/gmail/gmail-api-client-factory';
import type { OAuth2ClientLikeInterface } from '../../../../src/infrastructure/gmail/oauth2-client-like.interface';

const { gmailMock, importMock, listMock } = vi.hoisted(() => {
  const hoistedImportMock = vi.fn();
  const hoistedListMock = vi.fn();
  const hoistedGmailMock = vi.fn(() => ({
    users: {
      messages: {
        import: hoistedImportMock,
        list: hoistedListMock,
      },
    },
  }));

  return {
    gmailMock: hoistedGmailMock,
    importMock: hoistedImportMock,
    listMock: hoistedListMock,
  };
});

vi.mock('googleapis', () => ({
  google: {
    gmail: gmailMock,
  },
}));

describe('infrastructure/gmail/gmail-api-client-factory', () => {
  beforeEach(() => {
    gmailMock.mockClear();
    importMock.mockReset();
    listMock.mockReset();
  });

  it('creates a Gmail client wrapper and forwards import requests', async () => {
    importMock.mockResolvedValue({
      data: {
        id: 'gmail-imported-id',
      },
    });

    const factory = new GmailApiClientFactory();
    const oauthClient: OAuth2ClientLikeInterface = {
      credentials: {
        refresh_token: 'refresh-token',
      },
      setCredentials(): void {},
    };

    const client = factory.create(oauthClient);
    const response = await client.users.messages.import({
      requestBody: {
        internalDateSource: 'dateHeader',
        labelIds: ['INBOX', 'UNREAD'],
        raw: 'encoded-message',
      },
      userId: 'destination@gmail.com',
    });

    expect(gmailMock).toHaveBeenCalledWith({
      auth: oauthClient,
      version: 'v1',
    });
    expect(importMock).toHaveBeenCalledWith({
      internalDateSource: 'dateHeader',
      requestBody: {
        labelIds: ['INBOX', 'UNREAD'],
        raw: 'encoded-message',
      } satisfies gmail_v1.Schema$Message,
      userId: 'destination@gmail.com',
    } satisfies gmail_v1.Params$Resource$Users$Messages$Import);
    expect(response).toEqual({
      data: {
        id: 'gmail-imported-id',
      },
    });
  });

  it('forwards Gmail lookup requests', async () => {
    listMock.mockResolvedValue({
      data: {
        messages: [{ id: 'gmail-message-id' }],
      },
    });

    const factory = new GmailApiClientFactory();
    const client = factory.create({
      credentials: {},
      setCredentials(): void {},
    });

    const response = await client.users.messages.list({
      maxResults: 1,
      q: 'rfc822msgid:abc123@example.com',
      userId: 'destination@gmail.com',
    });

    expect(listMock).toHaveBeenCalledWith({
      maxResults: 1,
      q: 'rfc822msgid:abc123@example.com',
      userId: 'destination@gmail.com',
    } satisfies gmail_v1.Params$Resource$Users$Messages$List);
    expect(response).toEqual({
      data: {
        messages: [{ id: 'gmail-message-id' }],
      },
    });
  });
});
