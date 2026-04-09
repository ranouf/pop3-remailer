import { describe, expect, it } from 'vitest';

import { Uidl } from '../../../../src/core/email/uidl';
import { EmailRecordStatus } from '../../../../src/core/email/processed-email';
import { JobRunStatus } from '../../../../src/core/job-run';
import { EmailMessageHelper } from '../../../../src/core/email';
import { EmailTransferFunctionTest } from './email-transfer.function.test';

describe('integration/transfer-email/functions/email-transfer.function', () => {
  it('transfers a single POP3 email through the function entrypoint', async () => {
    const message = EmailTransferFunctionTest.createPop3Message('uidl-1', {
      messageId: 'message@example.com',
      messageNumber: 1,
    });
    const test = new EmailTransferFunctionTest([message]);

    await test.initialize();

    const result = await test.factory.entrypoint.run();
    const jobRunRepository = test.jobRunRepository;
    const processedEmailRepository = test.processedEmailRepository;
    const jobRunStatisticsRepository = test.jobRunStatisticsRepository;
    const jobRuns = await jobRunRepository.listBySourceAccount(
      EmailTransferFunctionTest.sourceAccountId,
    );
    const processedEmail = await processedEmailRepository.findByUidl(
      EmailTransferFunctionTest.sourceAccountId,
      Uidl.create('uidl-1'),
    );
    const gmailClient = test.gmailApiClientFactory.clients[0];
    const statistics = await jobRunStatisticsRepository.get(
      EmailTransferFunctionTest.sourceAccountId,
    );

    expect(result.summary.status).toBe(JobRunStatus.Completed);
    expect(result.summary.detectedCount).toBe(1);
    expect(result.summary.transferredCount).toBe(1);
    expect(jobRuns).toHaveLength(1);
    expect(jobRuns[0]?.status).toBe(JobRunStatus.Completed);
    expect(processedEmail?.status).toBe(EmailRecordStatus.Imported);
    expect(processedEmail?.gmailMessageId).toBe('fake-gmail-message-id');
    expect(gmailClient?.importedMessages).toHaveLength(1);
    expect(gmailClient?.importedMessages[0]?.userId).toBe(
      'destination@gmail.com',
    );
    expect(
      EmailMessageHelper.extractRfc822MessageId(
        Buffer.from(
          gmailClient?.importedMessages[0]?.raw ?? '',
          'base64url',
        ).toString('utf8'),
      ),
    ).toBe('message@example.com');
    expect(test.amplitudeNodeClient.trackedEvents.length).toBeGreaterThan(0);
    expect(statistics?.sourceAccountId).toBe(
      EmailTransferFunctionTest.sourceAccountId,
    );
    expect(statistics?.kpis.lastRun?.jobId).toBe(result.summary.jobId);
    expect(statistics?.kpis.transferredLast24h).toBe(1);
  });

  it('transfers multiple POP3 emails in a single run', async () => {
    const test = new EmailTransferFunctionTest([
      EmailTransferFunctionTest.createPop3Message('uidl-1', {
        messageId: 'message-1@example.com',
        messageNumber: 1,
      }),
      EmailTransferFunctionTest.createPop3Message('uidl-2', {
        messageId: 'message-2@example.com',
        messageNumber: 2,
      }),
    ]);

    await test.initialize();

    const result = await test.factory.entrypoint.run();
    const jobRunRepository = test.jobRunRepository;
    const processedEmailRepository = test.processedEmailRepository;
    const jobRunStatisticsRepository = test.jobRunStatisticsRepository;
    const jobRuns = await jobRunRepository.listBySourceAccount(
      EmailTransferFunctionTest.sourceAccountId,
    );
    const firstProcessedEmail = await processedEmailRepository.findByUidl(
      EmailTransferFunctionTest.sourceAccountId,
      Uidl.create('uidl-1'),
    );
    const secondProcessedEmail = await processedEmailRepository.findByUidl(
      EmailTransferFunctionTest.sourceAccountId,
      Uidl.create('uidl-2'),
    );
    const importedMessages = test.gmailApiClientFactory.clients.flatMap(
      (client) => client.importedMessages,
    );
    const statistics = await jobRunStatisticsRepository.get(
      EmailTransferFunctionTest.sourceAccountId,
    );

    expect(result.summary.status).toBe(JobRunStatus.Completed);
    expect(result.summary.detectedCount).toBe(2);
    expect(result.summary.transferredCount).toBe(2);
    expect(result.summary.failedCount).toBe(0);
    expect(jobRuns).toHaveLength(1);
    expect(jobRuns[0]?.transferredCount).toBe(2);
    expect(firstProcessedEmail?.status).toBe(EmailRecordStatus.Imported);
    expect(secondProcessedEmail?.status).toBe(EmailRecordStatus.Imported);
    expect(importedMessages).toHaveLength(2);
    expect(statistics?.kpis.transferredLast24h).toBe(2);
  });

  it('completes successfully when there is no POP3 email to transfer', async () => {
    const test = new EmailTransferFunctionTest([]);

    await test.initialize();

    const result = await test.factory.entrypoint.run();
    const jobRunRepository = test.jobRunRepository;
    const jobRunStatisticsRepository = test.jobRunStatisticsRepository;
    const jobRuns = await jobRunRepository.listBySourceAccount(
      EmailTransferFunctionTest.sourceAccountId,
    );
    const gmailClient = test.gmailApiClientFactory.clients[0];
    const statistics = await jobRunStatisticsRepository.get(
      EmailTransferFunctionTest.sourceAccountId,
    );

    expect(result.summary.status).toBe(JobRunStatus.Completed);
    expect(result.summary.detectedCount).toBe(0);
    expect(result.summary.transferredCount).toBe(0);
    expect(result.summary.failedCount).toBe(0);
    expect(jobRuns).toHaveLength(1);
    expect(jobRuns[0]?.detectedCount).toBe(0);
    expect(gmailClient?.importedMessages ?? []).toHaveLength(0);
    expect(statistics?.kpis.detectedLast24h).toBe(0);
  });

  it('skips a POP3 email that has already been imported', async () => {
    const message = EmailTransferFunctionTest.createPop3Message('uidl-1', {
      messageId: 'message@example.com',
      messageNumber: 1,
    });
    const test = new EmailTransferFunctionTest([message]);

    await test.initialize();
    await test.seedImportedEmail(message);

    const result = await test.factory.entrypoint.run();
    const jobRunRepository = test.jobRunRepository;
    const processedEmailRepository = test.processedEmailRepository;
    const jobRunStatisticsRepository = test.jobRunStatisticsRepository;
    const jobRuns = await jobRunRepository.listBySourceAccount(
      EmailTransferFunctionTest.sourceAccountId,
    );
    const processedEmail = await processedEmailRepository.findByUidl(
      EmailTransferFunctionTest.sourceAccountId,
      Uidl.create('uidl-1'),
    );
    const gmailClient = test.gmailApiClientFactory.clients[0];
    const statistics = await jobRunStatisticsRepository.get(
      EmailTransferFunctionTest.sourceAccountId,
    );

    expect(result.summary.status).toBe(JobRunStatus.Completed);
    expect(result.summary.detectedCount).toBe(0);
    expect(result.summary.transferredCount).toBe(0);
    expect(result.summary.skippedCount).toBe(0);
    expect(jobRuns).toHaveLength(1);
    expect(jobRuns[0]?.skippedCount).toBe(0);
    expect(processedEmail?.status).toBe(EmailRecordStatus.Imported);
    expect(processedEmail?.gmailMessageId).toBe('existing-gmail-message-id');
    expect(gmailClient?.importedMessages ?? []).toHaveLength(0);
    expect(statistics?.kpis.lastRun?.skippedCount).toBe(0);
  });
});
