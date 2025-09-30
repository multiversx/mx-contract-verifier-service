import { BadRequestException } from "@nestjs/common";

export class InvalidTransactionException extends BadRequestException {
  constructor(hash: string, events: [any]) {
    super({ hash, events }, `Invalid transaction for hash ${hash} with events ${events.toString()}.`);
  }
}
