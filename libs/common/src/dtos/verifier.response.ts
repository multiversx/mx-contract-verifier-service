import { ApiProperty } from '@nestjs/swagger';

export class SuccessfulVerifierResponse {
  @ApiProperty({ description: 'The address of the verified contract.', type: String })
  address: string;

  @ApiProperty({ description: 'The code hash of the verified contract.', type: String })
  codeHash: string;

  @ApiProperty({
    description: 'The IPFS file hash of the verified contract.',
    type: String,
  })
  ipfsFileHash: string;

  @ApiProperty({ description: 'The Docker image used for verification.', type: String })
  dockerImage: string;

  constructor(options: {
    address: string;
    codeHash: string;
    ipfsFileHash: string;
    dockerImage: string;
  }) {
    this.address = options.address;
    this.codeHash = options.codeHash;
    this.ipfsFileHash = options.ipfsFileHash;
    this.dockerImage = options.dockerImage;
  }
}

export class ErrorVerifierResponse {
  @ApiProperty({ description: 'The error message.', type: String })
  message: string;

  @ApiProperty({ description: 'The error details.', type: String })
  error: string;

  @ApiProperty({ description: 'The HTTP status code.', type: Number })
  statusCode: number;

  constructor(options: { message: string; error: string; statusCode: number }) {
    this.message = options.message;
    this.error = options.error;
    this.statusCode = options.statusCode;
  }
}
