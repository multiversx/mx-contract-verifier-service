import { BadRequestException } from "@nestjs/common";

export class InvalidCodeException extends BadRequestException {
  constructor(code?: string, transactionCode?: string) {
    super({ code, transactionCode }, `Invalid code ${code} and transaction code ${transactionCode}.`);
  }
}
