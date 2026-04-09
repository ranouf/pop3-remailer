import { describe, expect, it } from 'vitest';

import { FakeAmplitudeNodeClient } from '../../../../src/infrastructure/analytics/tests/fake-amplitude-node-client';
import { FakeGmailApiClientFactory } from '../../../../src/infrastructure/email/gmail/tests/fake-gmail-api-client-factory';
import { FakePop3CommandFactory } from '../../../../src/infrastructure/email/node-pop3/tests/fake-pop3-command-factory';
import { EmailTransferFunction } from '../../../../src/jobs/email-transfer/email-transfer.function';
import { EmailTransferModule } from '../../../../src/jobs/email-transfer/email-transfer.module';
import { testApplicationConfiguration } from '../configuration/test-application-configuration';
import { EmailTransferTestModule } from './email-transfer-test.module';

describe('tests/jobs/email-transfer/bootstrap/email-transfer-test.module', () => {
  it('resolves EmailTransferFunction with overridden infrastructure services', () => {
    const container = EmailTransferTestModule.createContainer({
      amplitudeNodeClient: new FakeAmplitudeNodeClient(),
      config: testApplicationConfiguration,
      gmailApiClientFactory: new FakeGmailApiClientFactory(),
      pop3CommandFactory: new FakePop3CommandFactory(),
    });

    const functionInstance = container.get<EmailTransferFunction>(
      EmailTransferModule.EmailTransferFunction,
    );

    expect(functionInstance).toBeInstanceOf(EmailTransferFunction);
  });
});
