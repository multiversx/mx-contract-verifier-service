import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsScAddress } from '../decorators';

export class VerifierDeletionPayload {
  constructor(partial?: Partial<VerifierDeletionPayload>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'Contract address.', type: String })
  @IsString()
  @IsNotEmpty()
  @IsScAddress()
  contract: string = '';

  @ApiProperty({ description: 'Source code hash.' })
  @IsString()
  @IsNotEmpty()
  codeHash: string = '';
}
