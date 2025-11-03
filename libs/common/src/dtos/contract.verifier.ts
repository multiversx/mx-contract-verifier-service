import { ApiProperty } from '@nestjs/swagger';
import { ContractVerifierStatus } from './common';
import { ContractVerifierSource } from './contract.verifier.source';

export class ContractVerifier {
  @ApiProperty({ description: 'Source code hash' })
  codeHash?: string = '';

  @ApiProperty({
    description: 'Source code of contract',
    type: ContractVerifierSource,
  })
  source?: ContractVerifierSource;

  @ApiProperty({
    description: 'Verifier process status',
    enum: ContractVerifierStatus,
  })
  status!: ContractVerifierStatus;

  @ApiProperty({ description: 'File hash for IPFS' })
  ipfsFileHash?: string;

  @ApiProperty({ description: 'Docker image used' })
  dockerImage?: string;
}
