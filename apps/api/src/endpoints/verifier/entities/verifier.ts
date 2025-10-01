import { ApiProperty } from '@nestjs/swagger';
import { VerifierPayload } from './verifier.payload';

export class Verifier {
  constructor(partial?: Partial<Verifier>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'Payload signature', type: String })
  signature: string = '';

  @ApiProperty({ description: 'Payload', type: VerifierPayload })
  payload!: VerifierPayload;
}
