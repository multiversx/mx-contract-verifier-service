import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { VerifierPayload } from './verifier.payload';

export class Verifier {
  constructor(partial?: Partial<Verifier>) {
    Object.assign(this, partial);
  }

  @ApiProperty({
    description: 'Payload signature (no longer required)',
    type: String,
    required: false,
  })
  @IsString()
  @IsOptional()
  signature?: string;

  @ApiProperty({ description: 'Payload', type: VerifierPayload, required: true })
  @ValidateNested()
  @Type(() => VerifierPayload)
  @IsNotEmpty()
  payload!: VerifierPayload;
}
