import { ContractVerifierStatus } from "./common";

export class VerifierResponse {
  constructor(partial?: Partial<VerifierResponse>) {
    Object.assign(this, partial);
  }

  status!: ContractVerifierStatus;
  message?: string = '';
}
