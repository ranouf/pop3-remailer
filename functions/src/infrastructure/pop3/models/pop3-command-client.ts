export interface Pop3CommandClient {
  LIST(messageNumber?: number | string): Promise<string[][] | string[]>;
  QUIT(): Promise<string>;
  RETR(messageNumber: number): Promise<string>;
  UIDL(messageNumber?: number | string): Promise<string[][] | string[]>;
  connect(): Promise<void>;
}
