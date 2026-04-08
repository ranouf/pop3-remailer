export interface Pop3CommandClientInterface {
  LIST(messageNumber?: number | string): Promise<string[][] | string[]>;
  QUIT(): Promise<string>;
  RETR(messageNumber: number): Promise<string>;
  STAT(): Promise<string>;
  UIDL(messageNumber?: number | string): Promise<string[][] | string[]>;
  connect(): Promise<void>;
}
