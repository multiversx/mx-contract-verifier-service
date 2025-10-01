import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifierPayload {
  constructor(partial?: Partial<VerifierPayload>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'Contract address.', type: String })
  contract: string = '';

  @ApiProperty({ description: 'Docker image.', type: String })
  dockerImage: string = '';

  @ApiProperty({ description: 'Source code.' })
  sourceCode: any;

  @ApiPropertyOptional({ description: 'Optional contract name' })
  contractVariant?: string;
}
