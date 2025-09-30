import { ContractVerifierStatus } from "./common";

export class ContractVerifierModel {
  codeHash?: string = '';
  source?: string = '';
  status!: ContractVerifierStatus;
  ipfsFileHash?: string = '';
  dockerImage?: string = '';
}
