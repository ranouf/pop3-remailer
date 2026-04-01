export const foundationMarker = 'project-foundation';

export * from './config/environment';
export * from './config/runtime';
export * from './domain/email';
export * from './domain/errors';
export * from './domain/job-run';
export * from './domain/ports';
export * from './domain/processed-email';
export * from './domain/uidl';
export * from './infrastructure/firestore/firestore-job-run-repository';
export * from './infrastructure/firestore/firestore-keys';
export * from './infrastructure/firestore/firestore-mappers';
export * from './infrastructure/firestore/firestore-processed-email-repository';
export * from './infrastructure/firestore/firestore-types';
export * from './infrastructure/logging/structured-console-logger';
export * from './shared/email-message';
export * from './shared/operation-context';
export * from './shared/retry';
