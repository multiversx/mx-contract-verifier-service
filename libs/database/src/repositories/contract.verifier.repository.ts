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
    await this.contractVerifierModel.findOneAndUpdate(
      { address },
      { $set: verifier },
      { upsert: true },
    );
  }

  async findOne(address: string): Promise<ContractVerifier | null> {
    const result = await this.contractVerifierModel.findOne({ address }).lean().exec();
    if (!result) return null;

    return result;
  }

  async findVerified(
    projection?: Record<string, number>,
  ): Promise<Partial<ContractVerifier>[]> {
    return await this.contractVerifierModel
      .find({ status: ContractVerifierStatus.success })
      .select(projection || {})
      .lean()
      .exec();
  }

  /** Find contracts that were verified but the bytecode has changed. */
  async findOutdated(
    projection?: Record<string, number>,
  ): Promise<Partial<ContractVerifier>[]> {
    return await this.contractVerifierModel
      .find({ status: ContractVerifierStatus.byteCodeChangedSinceLastVerification })
      .select(projection || {})
      .lean()
      .exec();
  }

  async delete(address: string): Promise<ContractVerifier | null> {
    const result = await this.contractVerifierModel
      .findOneAndDelete({ address })
      .lean()
      .exec();

    if (!result) return null;

    return result;
  }
}
