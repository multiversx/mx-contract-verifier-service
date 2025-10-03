import { ApiProperty } from '@nestjs/swagger';

export class VerifierDeletionPayload {
  constructor(partial?: Partial<VerifierDeletionPayload>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'Contract address.', type: String })
  contract: string = '';

  @ApiProperty({ description: 'Source code hash.' })
  codeHash: string = '';
}
