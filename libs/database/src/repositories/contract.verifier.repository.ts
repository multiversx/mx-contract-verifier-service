import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ContractVerifierStatus } from '../../../common/src';
import { ContractVerifier, ContractVerifierDocument } from '../../../entities/src';

@Injectable()
export class ContractVerifierRepository {
  constructor(
    @InjectModel(ContractVerifier.name)
    private contractVerifierModel: Model<ContractVerifierDocument>,
  ) {}

  async save(address: string, verifier: Partial<ContractVerifier>): Promise<void> {
    const toSave = {
      ...verifier,
      source: verifier.source ? JSON.stringify(verifier.source) : undefined,
    };

    await this.contractVerifierModel.findOneAndUpdate(
      { address },
      { $set: toSave },
      { upsert: true },
    );
  }

  async findOne(address: string): Promise<ContractVerifier | null> {
    const result = await this.contractVerifierModel.findOne({ address }).lean().exec();
    if (!result) return null;

    return {
      ...result,
      source:
        typeof result.source === 'string' ? JSON.parse(result.source) : result.source,
    } as ContractVerifier;
  }

  async findVerified(
    projection?: Record<string, number>,
  ): Promise<Partial<ContractVerifier>[]> {
    const results = await this.contractVerifierModel
      .find({ status: ContractVerifierStatus.success })
      .select(projection || {})
      .lean()
      .exec();

    return results.map((doc) => ({
      ...doc,
      source: typeof doc.source === 'string' ? JSON.parse(doc.source) : doc.source,
    }));
  }

  /* Find contracts that were verified but the bytecode has changed */
  async findOutdated(
    projection?: Record<string, number>,
  ): Promise<Partial<ContractVerifier>[]> {
    const results = await this.contractVerifierModel
      .find({ status: ContractVerifierStatus.byteCodeChangedSinceLastVerification })
      .select(projection || {})
      .lean()
      .exec();

    return results.map((doc) => ({
      ...doc,
      source: typeof doc.source === 'string' ? JSON.parse(doc.source) : doc.source,
    }));
  }

  async delete(address: string): Promise<ContractVerifier | null> {
    const result = await this.contractVerifierModel
      .findOneAndDelete({ address })
      .lean()
      .exec();
    if (!result) return null;
    return {
      ...result,
      source:
        typeof result.source === 'string' ? JSON.parse(result.source) : result.source,
    } as ContractVerifier;
  }
}
