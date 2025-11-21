export class SuccessfulVerifierResponse {
  address: string;
  codeHash: string;
  ipfsFileHash: string;
  dockerImage: string;

  constructor(options: {address: string; codeHash: string; ipfsFileHash: string; dockerImage: string}) {
    this.address = options.address;
    this.codeHash = options.codeHash;
    this.ipfsFileHash = options.ipfsFileHash;
    this.dockerImage = options.dockerImage;
  }
}

export class ErrorVerifierResponse {
  message: string;
  error: string;
  statusCode: number;

  constructor(options: {message: string; error: string; statusCode: number}) {
    this.message = options.message;
    this.error = options.error;
    this.statusCode = options.statusCode;
  }
}
