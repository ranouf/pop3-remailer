import { RunEmailTransferJobHelper } from './run-email-transfer-job.helper';

export async function runEmailTransferJobLocally(): Promise<void> {
  await RunEmailTransferJobHelper.run();
}

void (async () => {
  if (require.main === module) {
    await runEmailTransferJobLocally();
  }
})();
