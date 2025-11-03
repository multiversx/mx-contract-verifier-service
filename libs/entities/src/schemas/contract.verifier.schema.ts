import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ContractVerifierDocument = ContractVerifier & Document;

class ContractVerifierSource {
  abi: any = '';
  contract: any = '';
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

  @Prop()
  codeHash?: string;

  @Prop({ type: Object })
  source?: ContractVerifierSource;

  @Prop()
  ipfsFileHash?: string;

  @Prop()
  dockerImage?: string;

  @Prop({
    enum: ContractVerifierStatus,
    default: ContractVerifierStatus.success,
  })
  status!: ContractVerifierStatus;
}

export const ContractVerifierSchema =
  SchemaFactory.createForClass(ContractVerifier);
