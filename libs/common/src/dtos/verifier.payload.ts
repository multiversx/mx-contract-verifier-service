import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { IsScAddress } from '../decorators';

export class VerifierPayload {
  constructor(partial?: Partial<VerifierPayload>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'Contract address.', type: String })
  @IsString()
  @IsNotEmpty()
  @IsScAddress()
  contract: string = '';

  @ApiProperty({ description: 'Docker image.', type: String })
  @IsString()
  @IsNotEmpty()
  dockerImage: string = '';

  @ApiProperty({ description: 'The packaged source code.' })
  @IsObject()
  @IsNotEmpty()
  sourceCode: any;

  @ApiPropertyOptional({ description: 'Optional contract name' })
  @IsString()
  @IsOptional()
  contractVariant?: string;
}
