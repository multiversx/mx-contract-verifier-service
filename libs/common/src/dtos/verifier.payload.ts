import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifierPayload {
  constructor(partial?: Partial<VerifierPayload>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'Contract address.', type: String })
  @IsString()
  @IsNotEmpty()
  contract: string = '';

  @ApiProperty({ description: 'Docker image.', type: String })
  @IsString()
  @IsNotEmpty()
  dockerImage: string = '';

  @ApiProperty({ description: 'Source code.' })
  @IsString()
  @IsNotEmpty()
  sourceCode: any;

  @ApiPropertyOptional({ description: 'Optional contract name' })
  @IsString()
  contractVariant?: string;
}
