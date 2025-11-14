import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { VerifierDeletionPayload } from './verifier.deletion.payload';

export class VerifierDeletion {
  constructor(partial?: Partial<VerifierDeletion>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'Payload signature', type: String })
  @IsString()
  @IsNotEmpty()
  signature: string = '';

  @ApiProperty({ description: 'Payload', type: VerifierDeletionPayload })
  @ValidateNested()
  @Type(() => VerifierDeletionPayload)
  @IsNotEmpty()
  payload!: VerifierDeletionPayload;
}
