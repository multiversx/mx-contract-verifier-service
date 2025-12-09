import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ContractVerifierDocument = ContractVerifier & Document;

class ContractVerifierSource {
  abi: string = '';
  contract: string = '';
}

enum ContractVerifierStatus {
  inProgress = 'inProgress',
  success = 'success',
  error = 'error',
  byteCodeChangedSinceLastVerification = 'byteCodeChangedSinceLastVerification',
}

@Schema({ collection: 'contract_verifiers' })
export class ContractVerifier {
  @Prop({ required: true, unique: true })
  address!: string;

  @Prop({ required: true })
  codeHash!: string;

  @Prop({ type: Object, required: true })
  source!: ContractVerifierSource;

  @Prop({ required: true })
  ipfsFileHash!: string;

  @Prop({ required: true })
  dockerImage!: string;

  @Prop({
    enum: ContractVerifierStatus,
    required: true,
  })
  status!: ContractVerifierStatus;
}

export const ContractVerifierSchema = SchemaFactory.createForClass(ContractVerifier);
