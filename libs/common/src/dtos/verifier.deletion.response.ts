import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export class VerifierDeletionResponse {
  constructor(partial?: Partial<VerifierDeletionResponse>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'Response message.', type: String })
  message: string = '';

  @ApiProperty({ description: 'HTTP status code.', type: Number, default: HttpStatus.OK })
  statusCode: number = HttpStatus.OK;
}
