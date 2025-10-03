import { ApiProperty } from '@nestjs/swagger';

export class VerifierCodeHashResponse {
  constructor(partial?: Partial<VerifierCodeHashResponse>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'Verification codeHash', type: String })
  codeHash!: string;
}
