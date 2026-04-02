export const firebaseFunctionsRuntime = 'nodejs22' as const;
export const supportedNodeMajorVersion = 22;
export const scheduledTransferCron = 'every 5 minutes';

export const environmentFileNames = ['.env.local', '.env.test.local'] as const;

export type LocalEnvironmentFileName = (typeof environmentFileNames)[number];

export const resolveLocalEnvironmentFileName = (
  nodeEnv: string | undefined,
): LocalEnvironmentFileName =>
  nodeEnv === 'test' ? '.env.test.local' : '.env.local';
