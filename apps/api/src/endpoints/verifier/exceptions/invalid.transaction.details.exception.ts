import { BadRequestException } from '@nestjs/common';

export class InvalidTransactionDetailsException extends BadRequestException {
  constructor(hash: string) {
    super(
      { hash },
      `Invalid transaction details for transaction hash ${hash}.`,
    );
  }
}
