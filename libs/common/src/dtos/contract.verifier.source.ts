import { ApiProperty } from '@nestjs/swagger';

export class ContractVerifierSource {
  @ApiProperty({ description: 'Abi file source' })
  abi: any = '';

  @ApiProperty({ description: 'Contract source code' })
  contract: any = '';
}
