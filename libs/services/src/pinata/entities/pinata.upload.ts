export class PinataUpload {
  constructor(partial?: Partial<PinataUpload>) {
    Object.assign(this, partial);
  }

  hash: string = '';

  url: string = '';
}
