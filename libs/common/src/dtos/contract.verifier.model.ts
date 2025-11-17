import { ContractVerifierStatus } from './common';

export class ContractVerifierModel {
  codeHash?: string = '';
  source?: {
    abi: any;
    contract: any;
  };
  status!: ContractVerifierStatus;
  ipfsFileHash?: string = '';
  dockerImage?: string = '';
}
