import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { IsScAddress } from '../decorators';

export class VerifierFromExisting {
  constructor(partial?: Partial<VerifierFromExisting>) {
    Object.assign(this, partial);
  }

  @ApiProperty({
    description: 'Contract address to verify.',
    type: String,
    required: true,
  })
  @IsScAddress()
  @IsNotEmpty()
  contract: string = '';

  @ApiProperty({
    description: 'Existing verified contract address.',
    type: String,
    required: true,
  })
  @IsScAddress()
  @IsNotEmpty()
  existingVerifiedContract: string = '';
}
