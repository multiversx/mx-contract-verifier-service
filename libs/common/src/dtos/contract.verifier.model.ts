import { ContractVerifierStatus } from './common';

export type ContractVerifierModel = {
  codeHash: string;
  source: {
    abi: string;
    contract: string;
  };
  status: ContractVerifierStatus;
  ipfsFileHash: string;
  dockerImage: string;
}
