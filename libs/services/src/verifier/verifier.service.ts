import {
  CacheInfo,
  ContractVerifier,
  ContractVerifierModel,
  ContractVerifierSource,
  ContractVerifierStatus,
  SuccessfulVerifierResponse,
  Verifier,
  VerifierCodeHashResponse,
  VerifierDeletion,
  VerifierDeletionPayload,
  VerifierFromExisting,
  VerifierPayload,
} from '@libs/common';
import { CommonConfigService } from '@libs/common/config/common.config.service';
import { ContractVerifierRepository } from '@libs/database';
import { Address, Message, MessageComputer, UserVerifier } from '@multiversx/sdk-core';
import { CacheService } from '@multiversx/sdk-nestjs-cache';
import { ApiService } from '@multiversx/sdk-nestjs-http';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import crypto from 'crypto';
import fs from 'fs';
import sanitizeFilename from 'sanitize-filename';
import * as tmp from 'tmp';
import { promisify } from 'util';
import { DockerRunner } from '../docker/docker.runner';
import { PinataUpload } from '../pinata/entities/pinata.upload';
import { PinataService } from '../pinata/pinata.service';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

@Injectable()
export class VerifierService {
  private readonly dockerRunner: DockerRunner;
  private readonly logger: Logger;

  constructor(
    private readonly commonConfigurationService: CommonConfigService,
    private readonly contractVerifierRepository: ContractVerifierRepository,
    private readonly pinataService: PinataService,
    private readonly apiService: ApiService,
    private readonly cacheService: CacheService,
  ) {
    this.dockerRunner = new DockerRunner();
    this.logger = new Logger(VerifierService.name);
  }

  public async getContractVerifier(
    address: string,
    dependencyDepth: number = 0,
    includeTestFiles: boolean = false,
  ): Promise<ContractVerifier> {
    // If we want to return all deps, include also test files
    if (dependencyDepth === -1) {
      includeTestFiles = true;
    }

    const data = await this.getContractVerifierModel(address);
    if (!data) {
      this.logger.log(`No local data for address ${address}`);
      throw new NotFoundException(`Verified contract not found for address: ${address}`);
    }

    const apiResponse = await this.getContractDataFromApi(address);
    const remoteCodeHash = apiResponse?.codeHash;
    if (!remoteCodeHash) {
      this.logger.log(`No remote code hash for address ${address}`);
      throw new NotFoundException(`Verified contract not found for address: ${address}`);
    }

    const returnedData: ContractVerifier = data as any;

    if (data.codeHash !== Buffer.from(remoteCodeHash, 'base64').toString('hex')) {
      returnedData.status = ContractVerifierStatus.byteCodeChangedSinceLastVerification;
    }

    returnedData.source = {
      abi: JSON.parse(Buffer.from(data.source.abi, 'base64').toString()),
      contract: JSON.parse(Buffer.from(data.source.contract, 'base64').toString()),
    };

    // Filter result by depth
    if (returnedData.source?.contract && dependencyDepth > -1) {
      returnedData.source.contract.entries = returnedData.source.contract.entries.filter(
        (entry: any) => {
          // Filter out everything that is under /wasm/src*
          if (entry.path.startsWith('wasm/src/') || entry.path.includes('/wasm/src/')) {
            return false;
          }

          // Support old contract verifications without dependecy depth
          if (typeof entry.dependencyDepth === 'undefined') {
            return true;
          }

          if (
            typeof entry.dependencyDepth !== 'undefined' &&
            entry.dependencyDepth <= dependencyDepth
          ) {
            // If it is a test files at this depth but we don't want to include test files, skip it
            if (entry.isTestFile && !includeTestFiles) {
              return false;
            }

            return true;
          }

          return false;
        },
      );
    }

    return returnedData;
  }

  private async getContractVerifierModel(
    address: string,
  ): Promise<ContractVerifierModel | undefined> {
    return await this.cacheService.getOrSet(
      CacheInfo.VerifiedContractModel(address).key,
      async () => await this.getContractVerifierModelFromDb(address),
      CacheInfo.VerifiedContractModel(address).ttl,
    );
  }

  private async getContractVerifierModelFromDb(
    address: string,
  ): Promise<ContractVerifierModel | undefined> {
    const result = await this.contractVerifierRepository.findOne(address);
    if (!result) {
      return undefined;
    }

    return {
      address: result.address,
      codeHash: result.codeHash,
      source: {
        abi: result.source.abi,
        contract: result.source.contract,
      },
      status: result.status,
      ipfsFileHash: result.ipfsFileHash,
      dockerImage: result.dockerImage,
    };
  }

  public async getVerifiedContracts(): Promise<string[]> {
    const data = await this.getVerifiedContractsOutModel(['address']);
    return data.map((contract) => contract.address || '');
  }

  public async getOutdatedContracts(): Promise<string[]> {
    const data = await this.getOutdatedContractsOutModel(['address']);
    return data.map((contract) => contract.address || '');
  }

  private selectFieldsToInclude(
    fieldsToInclude?: (keyof ContractVerifierModel)[],
  ): Record<string, number> {
    const selectFields: Record<string, number> = {};
    if (fieldsToInclude) {
      for (const field of fieldsToInclude) {
        selectFields[field] = 1;
      }
    }
    return selectFields;
  }

  private async getVerifiedContractsOutModel(
    fieldsToInclude?: (keyof ContractVerifierModel)[],
  ): Promise<Partial<ContractVerifierModel>[]> {
    const selectFields = this.selectFieldsToInclude(fieldsToInclude);

    const result = await this.contractVerifierRepository.findVerified(selectFields);

    return result.map((entry) => ({
      address: entry.address,
      status: entry.status,
      codeHash: entry.codeHash,
      ipfsFileHash: entry.ipfsFileHash,
      dockerImage: entry.dockerImage,
      source: entry.source,
    }));
  }

  private async getOutdatedContractsOutModel(
    fieldsToInclude?: (keyof ContractVerifierModel)[],
  ): Promise<Partial<ContractVerifierModel>[]> {
    const selectFields = this.selectFieldsToInclude(fieldsToInclude);

    const result = await this.contractVerifierRepository.findOutdated(selectFields);

    return result.map((entry) => ({
      address: entry.address,
      status: entry.status,
      codeHash: entry.codeHash,
      ipfsFileHash: entry.ipfsFileHash,
      dockerImage: entry.dockerImage,
      source: entry.source,
    }));
  }

  private async getVerifiedContractsAndCodeHashes(): Promise<
    { address: string; codeHash: string }[]
  > {
    const data = await this.getVerifiedContractsOutModel(['address', 'codeHash']);

    const result = data
      .filter(
        (contract): contract is { address: string; codeHash: string } =>
          typeof contract.address === 'string' && typeof contract.codeHash === 'string',
      )
      .map((contract) => ({
        address: contract.address,
        codeHash: contract.codeHash,
      }));

    return result;
  }

  public async changeContractStatusIfByteCodeChanged(): Promise<void> {
    const verifiedContracts = await this.getVerifiedContractsAndCodeHashes();

    for (const contract of verifiedContracts) {
      const apiResponse = await this.getContractDataFromApi(contract.address, false);
      const remoteCodeHash: string | undefined = apiResponse?.codeHash;
      if (!remoteCodeHash) {
        this.logger.log(`No remote code hash for contract ${contract.address}`);
        continue;
      }

      const hexRemoteCodeHash = Buffer.from(remoteCodeHash, 'base64').toString('hex');

      if (contract.codeHash !== hexRemoteCodeHash) {
        this.logger.log(
          `Changing status for verified contract ${contract.address} as bytecode changed`,
        );
        await this.changeContractVerifierStatusTo(
          contract.address,
          ContractVerifierStatus.byteCodeChangedSinceLastVerification,
        );
      }
    }
  }

  private async changeContractVerifierStatusTo(
    contractAddress: string,
    status: ContractVerifierStatus,
  ) {
    return await this.contractVerifierRepository.save(contractAddress, {
      status,
    });
  }

  public async getContractVerifierCodeHash(
    address: string,
  ): Promise<VerifierCodeHashResponse> {
    const data = await this.getContractVerifierModel(address);

    if (!data) {
      throw new NotFoundException(`Verified contract not found for address: ${address}`);
    }

    return { codeHash: data.codeHash || '' };
  }

  public async removeContractVerifierSource(
    body: VerifierDeletion,
  ): Promise<ContractVerifierModel> {
    const apiResponse = await this.getContractDataFromApi(body.payload.contract);
    let ownerAddress: string | undefined = apiResponse?.ownerAddress;
    if (!ownerAddress) {
      this.logger.error(`No owner address for contract ${body.payload.contract}`);
      throw new BadRequestException(
        'Could not determine owner address for the contract.',
      );
    }

    if (Address.newFromBech32(ownerAddress).isSmartContract()) {
      ownerAddress = await this.getOwnerOfOwnerContract(ownerAddress);
    }

    if (!this.checkPayloadSignature(body.signature, body.payload, ownerAddress)) {
      throw new UnauthorizedException('Invalid signature');
    }

    const contractAddress = body.payload.contract;
    let result: ContractVerifierModel | undefined;

    try {
      result = await this.deleteContractVerifier(contractAddress);
    } catch (error) {
      this.logger.error(
        `Error deleting contract verifier for address ${contractAddress}: ${error}`,
      );
      throw new InternalServerErrorException('Failed to delete contract verifier');
    }

    if (!result) {
      throw new NotFoundException(
        `Verified contract not found for address: ${contractAddress}`,
      );
    }

    return result;
  }

  /**
   * Fetches the owner of the contract owner (when the contract owner is itself a smart contract).
   * If the owner of the contract owner is a smart contract, deletion is not allowed.
   */
  private async getOwnerOfOwnerContract(address: string): Promise<string> {
    const response = await this.getContractDataFromApi(address);
    const ownerAddress = response?.ownerAddress;
    if (!ownerAddress) {
      this.logger.error(`No owner address for contract ${address}`);
      throw new BadRequestException(
        'Could not determine owner address for the contract.',
      );
    }

    if (Address.newFromBech32(ownerAddress).isSmartContract()) {
      throw new UnauthorizedException(
        'Owner of the contract is a smart contract. Deletion not allowed.',
      );
    }

    return ownerAddress;
  }

  private async deleteContractVerifier(
    address: string,
  ): Promise<ContractVerifierModel | undefined> {
    const verifier = await this.getContractVerifierModel(address);
    if (!verifier) {
      return undefined;
    }

    await this.contractVerifierRepository.delete(address);
    return verifier;
  }

  private checkPayloadSignature(
    signature: string,
    payload: VerifierPayload | VerifierDeletionPayload,
    ownerAddress: string,
  ): boolean {
    const stringify = JSON.stringify(payload);
    const sha256 = crypto.createHash('sha256').update(stringify).digest('hex');
    const verifier = UserVerifier.fromAddress(new Address(ownerAddress));
    const message = Buffer.from(payload.contract + sha256);

    const signatureAsBuffer = Buffer.from(signature, 'hex');
    const firstVerificationResult = verifier.verify(message, signatureAsBuffer);

    const signableMessage = new Message({
      data: new Uint8Array(message),
    });

    const messageComputer = new MessageComputer();
    const verifyBytes = messageComputer.computeBytesForVerifying(signableMessage);

    const secondVerificationResult = verifier.verify(verifyBytes, signatureAsBuffer);

    return firstVerificationResult || secondVerificationResult;
  }

  public async validate(validateBody: Verifier): Promise<SuccessfulVerifierResponse> {
    this.logger.log(
      `Verifier process started for contract ${validateBody.payload.contract}`,
    );

    const contractAddress = validateBody.payload.contract;

    const apiResponse = await this.getContractDataFromApi(contractAddress);
    const remoteCodeHash = apiResponse?.codeHash;
    if (!remoteCodeHash) {
      this.logger.log(`No remote code hash for contract ${contractAddress}`);
      throw new BadRequestException('Could not retrieve code hash for the contract.');
    }
    const hexRemoteCodeHash = Buffer.from(remoteCodeHash, 'base64').toString('hex');

    const verifiedContract = await this.getContractVerifierModel(contractAddress);
    if (verifiedContract) {
      if (verifiedContract.codeHash === hexRemoteCodeHash) {
        this.logger.log(
          `Contract ${contractAddress} is already verified and the code hash did not change`,
        );

        return new SuccessfulVerifierResponse({
          address: contractAddress,
          codeHash: verifiedContract.codeHash,
          ipfsFileHash: verifiedContract.ipfsFileHash,
          dockerImage: verifiedContract.dockerImage,
        });
      }
    }

    const sourceCode = validateBody.payload.sourceCode;
    const contractName = sanitizeFilename(
      sourceCode.name || sourceCode.metadata.contractName,
    );
    const contractNameVariant = validateBody.payload.contractVariant
      ? sanitizeFilename(validateBody.payload.contractVariant)
      : undefined;
    const contractVersion = sourceCode.version || sourceCode.metadata.contractVersion;
    const dockerImage = validateBody.payload.dockerImage;

    if (
      !dockerImage ||
      dockerImage.split(':')[0] !== 'multiversx/sdk-rust-contract-builder'
    ) {
      throw new BadRequestException('Invalid docker image');
    }

    const temporaryFile = tmp.fileSync({
      prefix: `contract-src-${contractName}`,
      postfix: '.json',
    });
    const temporaryFolder = tmp.dirSync({
      template: `tmp-${contractName}-XXXXXX`,
      unsafeCleanup: true,
    });

    this.logger.log(
      `Write contract received source code temporary to: ${temporaryFile.name}`,
    );

    try {
      await writeFile(temporaryFile.fd, JSON.stringify(sourceCode));

      try {
        await this.dockerRunner.exec({
          image: dockerImage,
          packagedSrcPath: '/',
          outputVolumeMap: {
            from: temporaryFolder.name,
            to: '/output',
          },
          inputVolumeMap: {
            from: temporaryFile.name,
            to: '/packaged-src.json',
          },
          noDockerTty: true,
        });
      } catch (e) {
        this.logger.log(`Contract build error ${e}`, e);
        throw new InternalServerErrorException('Contract build failed');
      }

      this.logger.log(`Docker build finished without errors - ${contractName}`);
      this.logger.log(`Using temporary folder: ${temporaryFolder.name}/${contractName}`);

      const contractSourceFilePath = `${temporaryFolder.name}/${contractName}/${contractName}-${contractVersion}.source.json`;

      const tempContractName = contractNameVariant || contractName;
      const codeHashFilePath = `${temporaryFolder.name}/${contractName}/${tempContractName}.codehash.txt`;
      const contractAbiFileSourcePath = `${temporaryFolder.name}/${contractName}/${tempContractName}.abi.json`;

      const contractSource = await readFile(contractSourceFilePath);
      const codeHash = await readFile(codeHashFilePath);
      const contractAbi = await readFile(contractAbiFileSourcePath);

      this.logger.log(`Contract source read from ${contractSourceFilePath}`);
      this.logger.log(`Code hash read from ${codeHashFilePath} - ${codeHash}`);
      this.logger.log(`Contract ABI file read from ${contractAbiFileSourcePath}`);

      if (hexRemoteCodeHash !== codeHash.toString()) {
        this.logger.log(
          `Source code hashes do not match - ${codeHash.toString()} - ${hexRemoteCodeHash}`,
        );
        throw new BadRequestException(
          'Source code hash does not match deployed contract',
        );
      }

      const source = {
        abi: JSON.parse(contractAbi.toString()),
        contract: JSON.parse(contractSource.toString()),
      };

      const pinataData: PinataUpload | undefined = await this.pinataService.uploadContent(
        source,
      );

      if (!pinataData) {
        this.logger.log('Could not upload to IPFS');
        throw new InternalServerErrorException('Failed to upload contract to IPFS');
      }

      const code = new ContractVerifierSource();
      code.abi = contractAbi.toString('base64');
      code.contract = contractSource.toString('base64');

      await this.contractVerifierRepository.save(contractAddress, {
        source: code,
        codeHash: codeHash.toString(),
        ipfsFileHash: pinataData.hash,
        status: ContractVerifierStatus.success,
        dockerImage: dockerImage,
      });
      this.logger.log(
        `Contract verifier saved to database - contract: ${contractAddress} - pinata: ${pinataData.hash} - dockerImage: ${dockerImage}`,
      );

      return new SuccessfulVerifierResponse({
        address: contractAddress,
        codeHash: codeHash.toString(),
        ipfsFileHash: pinataData.hash,
        dockerImage: dockerImage,
      });
    } finally {
      temporaryFile.removeCallback();
      temporaryFolder.removeCallback();
    }
  }

  async validateFromExisting(
    validateFromExisting: VerifierFromExisting,
  ): Promise<SuccessfulVerifierResponse> {
    this.logger.log(
      `Verifier from existing process started for contract ${validateFromExisting.contract}`,
    );

    const verifiedContract = await this.getContractVerifierModel(
      validateFromExisting.existingVerifiedContract,
    );
    if (!verifiedContract) {
      this.logger.log(
        `No verified contract found for address ${validateFromExisting.existingVerifiedContract}`,
      );
      throw new NotFoundException(
        `Verified contract not found for address: ${validateFromExisting.existingVerifiedContract}`,
      );
    }

    const verifiedContractApiData = await this.getContractDataFromApi(
      validateFromExisting.existingVerifiedContract,
    );
    const verifiedRemoteCodeHash = Buffer.from(
      verifiedContractApiData?.codeHash,
      'base64',
    ).toString('hex');

    if (verifiedContract.codeHash !== verifiedRemoteCodeHash) {
      this.logger.log(
        `Bytecode changed for existing verified contract ${validateFromExisting.existingVerifiedContract}`,
      );
      throw new BadRequestException('Bytecode changed for existing verified contract');
    }

    const contractApiData = await this.getContractDataFromApi(
      validateFromExisting.contract,
    );
    const contractRemoteCodeHash = Buffer.from(
      contractApiData?.codeHash,
      'base64',
    ).toString('hex');

    if (verifiedContract.codeHash !== contractRemoteCodeHash) {
      this.logger.log(
        `Source code hashes do not match - existing verified contract: ${verifiedContract.codeHash} - target contract: ${contractRemoteCodeHash}`,
      );
      throw new BadRequestException('Source code hash does not match verified contract');
    }

    await this.contractVerifierRepository.save(validateFromExisting.contract, {
      source: verifiedContract.source,
      codeHash: verifiedContract.codeHash,
      ipfsFileHash: verifiedContract.ipfsFileHash,
      status: ContractVerifierStatus.success,
      dockerImage: verifiedContract.dockerImage,
    });
    this.logger.log(
      `Contract verifier from existing saved to database - contract: ${validateFromExisting.contract} - from existing verified contract: ${validateFromExisting.existingVerifiedContract}`,
    );

    return new SuccessfulVerifierResponse({
      address: validateFromExisting.contract,
      codeHash: verifiedContract.codeHash,
      ipfsFileHash: verifiedContract.ipfsFileHash,
      dockerImage: verifiedContract.dockerImage,
    });
  }

  private async getContractDataFromApi(
    address: string,
    shouldThrowError: boolean = true,
  ): Promise<any> {
    try {
      const apiResponse = await this.apiService.get(
        `${this.commonConfigurationService.config.urls.api}/accounts/${address}`,
      );
      return apiResponse.data;
    } catch (error: any) {
      this.logger.error(
        `Error fetching account data for contract ${address}, error: ${error.message}`,
      );

      if (shouldThrowError) {
        throw new InternalServerErrorException(
          `Failed to fetch account data for contract ${address}`,
        );
      }

      return null;
    }
  }
}
