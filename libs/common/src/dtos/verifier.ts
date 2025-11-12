import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { VerifierPayload } from './verifier.payload';

export class Verifier {
  constructor(partial?: Partial<Verifier>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'Payload signature', type: String })
  @IsString()
  @IsNotEmpty()
  signature: string = '';

  @ApiProperty({ description: 'Payload', type: VerifierPayload })
  @ValidateNested()
  @Type(() => VerifierPayload)
  @IsNotEmpty()
  payload!: VerifierPayload;
}
