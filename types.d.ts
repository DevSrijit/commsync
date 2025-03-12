declare module "imapflow" {
  export class ImapFlow {
    constructor(config: any);
    connect(): Promise<void>;
    mailboxOpen(mailbox: string): Promise<any>;
    fetch(options: any): AsyncIterableIterator<any>;
    logout(): Promise<void>;
  }
}

declare module "nodemailer" {
  function createTransport(options: any): any;
  export { createTransport };
}

declare module "mailparser" {
  export function simpleParser(source: any): Promise<any>;
}
