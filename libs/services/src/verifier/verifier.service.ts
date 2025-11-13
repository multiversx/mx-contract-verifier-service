import {
  CacheInfo,
  ContractVerifier,
  ContractVerifierModel,
  ContractVerifierOutModel,
  ContractVerifierSource,
  ContractVerifierStatus,
  Verifier,
  VerifierCodeHashResponse,
  VerifierDeletion,
  VerifierDeletionPayload,
  VerifierPayload,
  VerifierResponse,
} from '@libs/common';
import { CommonConfigService } from '@libs/common/config/common.config.service';
import { ContractVerifierRepository } from '@libs/database';
import {
  Address,
  Message,
  MessageComputer,
  UserVerifier,
} from '@multiversx/sdk-core';
import { CacheService } from '@multiversx/sdk-nestjs-cache';
import { AddressUtils } from '@multiversx/sdk-nestjs-common';
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

  private async getContractVerifierModel(
    address: string,
  ): Promise<ContractVerifierModel | undefined> {
    return await this.cacheService.getOrSet(
      CacheInfo.VerifiedContractModel.key + address,
      async () => await this.getContractVerifierModelFromDb(address),
      CacheInfo.VerifiedContractModel.ttl
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
      codeHash: result.codeHash,
      source: result.source?.contract,
      status: result.status,
      ipfsFileHash: result.ipfsFileHash,
      dockerImage: result.dockerImage,
    };
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
      throw new NotFoundException(
        `Verified contract not found for address: ${address}`,
      );
    }

    let apiResponse: any;
    try {
      apiResponse = await this.apiService.get(
        `${this.commonConfigurationService.config.urls.api}/accounts/${address}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Error fetching account data for address ${address}, error: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to fetch account data for address ${address}`,
      );
    }

    const remoteCodeHash: string = apiResponse.data?.codeHash;
    if (!remoteCodeHash) {
      this.logger.log(`No remote code hash for address ${address}`);
      throw new NotFoundException(
        `Verified contract not found for address: ${address}`,
      );
    }

    const returnedData: ContractVerifier = data as any;

    if (
      data.codeHash !== Buffer.from(remoteCodeHash, 'base64').toString('hex')
    ) {
      return {
        status: ContractVerifierStatus.byteCodeChangedSinceLastVerification,
      };
    }

    if (data.source) {
      returnedData.source = JSON.parse(
        Buffer.from(data.source, 'base64').toString(),
      );
    }

    // Filter result by depth
    if (returnedData.source?.contract && dependencyDepth > -1) {
      returnedData.source.contract.entries =
        returnedData.source.contract.entries.filter((entry: any) => {
          // Filter out everything that is under /wasm/src*
          if (
            entry.path.startsWith('wasm/src/') ||
            entry.path.includes('/wasm/src/')
          ) {
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
        });
    }

    return returnedData;
  }

  private async getVerifiedContractsOutModel(
    fieldsToInclude?: (keyof ContractVerifierOutModel)[],
  ): Promise<Partial<ContractVerifierOutModel>[]> {
    const selectFields: Record<string, number> = {};
    if (fieldsToInclude) {
      for (const field of fieldsToInclude) {
        selectFields[field] = 1;
      }
    }

    const result = await this.contractVerifierRepository.findVerified(selectFields);

    return result.map((entry) => ({
      address: entry.address,
      status: entry.status,
      codeHash: entry.codeHash,
      ipfsFileHash: entry.ipfsFileHash,
      dockerImage: entry.dockerImage,
      source: entry.source?.contract,
    }));
  }

  public async getVerifiedContracts(): Promise<string[]> {
    const data = await this.getVerifiedContractsOutModel(['address']);
    return data.map((contract) => contract.address || '');
  }

  private async getVerifiedContractsAndCodeHashes(): Promise<
    { address: string; codeHash: string }[]
  > {
    const data = await this.getVerifiedContractsOutModel([
      'address',
      'codeHash',
    ]);

    const result = data.map((contract) => ({
      address: contract.address || '',
      codeHash: contract.codeHash || '',
    }));

    return result;
  }

  public async deleteVerifiedContractsIfByteCodeChanged(): Promise<void> {
    const verifiedContracts = await this.getVerifiedContractsAndCodeHashes();

    for (const contract of verifiedContracts) {
      let apiResponse: any;
      try {
        apiResponse = await this.apiService.get(
          `${this.commonConfigurationService.config.urls.api}/accounts/${contract.address}`,
        );
      } catch (error: any) {
        this.logger.error(
          `Error fetching account data for contract ${contract.address}, error: ${error.message}`,
        );
        continue;
      }

      const remoteCodeHash: string = apiResponse.data?.codeHash;
      if (!remoteCodeHash) {
        this.logger.log(
          `No remote code hash for contract ${contract.address}`,
        );
        continue;
      }

      const hexRemoteCodeHash = Buffer.from(remoteCodeHash, 'base64').toString(
        'hex',
      );

      if (contract.codeHash !== hexRemoteCodeHash) {
        this.logger.log(
          `Deleting verified contract ${contract.address} as bytecode changed`,
        );
        await this.deleteContractVerifier(contract.address);
      }
    }
  }

  public async getContractVerifierCodeHash(
    address: string,
  ): Promise<VerifierCodeHashResponse> {
    if (!AddressUtils.isAddressValid(address)) {
      throw new BadRequestException(
        "Validation failed for 'address' argument. Expected a valid bech32 address.",
      );
    }

    const data = await this.getContractVerifierModel(address);

    if (!data) {
      throw new NotFoundException(
        `Verified contract not found for address: ${address}`,
      );
    }

    return { codeHash: data.codeHash || '' };
  }

  public async removeContractVerifierSource(
    body: VerifierDeletion,
  ): Promise<any> {
    let apiResponse: any;
    try {
      apiResponse = await this.apiService.get(
        `${this.commonConfigurationService.config.urls.api}/accounts/${body.payload.contract}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Error fetching account data for contract ${body.payload.contract}, error: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to fetch account data for contract ${body.payload.contract}`,
      );
    }

    const ownerAddress = apiResponse.data?.ownerAddress;
    if (!ownerAddress) {
      this.logger.error(
        `No owner address for contract ${body.payload.contract}`,
      );
      throw new BadRequestException(
        'Could not determine owner address for the contract.',
      );
    }

    if (
      !this.checkPayloadSignature(body.signature, body.payload, ownerAddress)
    ) {
      throw new UnauthorizedException('Invalid signature');
    }

    const contractAddress = body.payload.contract;
    const result = await this.deleteContractVerifier(contractAddress);
    if (!result) {
      throw new NotFoundException(
        `Verified contract not found for address: ${contractAddress}`,
      );
    }

    return result;
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
    const verifyBytes =
      messageComputer.computeBytesForVerifying(signableMessage);

    const secondVerificationResult = verifier.verify(
      verifyBytes,
      signatureAsBuffer,
    );

    return firstVerificationResult || secondVerificationResult;
  }

  private async changeContractVerifierStatusTo(
    contractAddress: string,
    status: ContractVerifierStatus,
  ) {
    return await this.contractVerifierRepository.save(contractAddress, {
      status: status,
    });
  }

  public async validate(validateBody: Verifier): Promise<VerifierResponse> {
    this.logger.log(
      `Verifier process started for contract ${validateBody.payload.contract}`,
    );

    const sourceCode = validateBody.payload.sourceCode;
    const contractName = sanitizeFilename(
      sourceCode.name || sourceCode.metadata.contractName,
    );
    const contractNameVariant = validateBody.payload.contractVariant
      ? sanitizeFilename(validateBody.payload.contractVariant)
      : undefined;
    const contractVersion =
      sourceCode.version || sourceCode.metadata.contractVersion;
    const dockerImage = validateBody.payload.dockerImage;

    if (
      !dockerImage ||
      dockerImage.split(':')[0] !== 'multiversx/sdk-rust-contract-builder'
    ) {
      return {
        status: ContractVerifierStatus.error,
        message: 'Invalid docker image',
      };
    }

    const temporaryFile = tmp.fileSync({
      prefix: `contract-src-${contractName}`,
      postfix: '.json',
    });
    const temporaryFolder = tmp.dirSync({
      template: `tmp-${contractName}-XXXXXX`,
      unsafeCleanup: true,
    });

    const contractAddress = validateBody.payload.contract;

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
        return {
          status: ContractVerifierStatus.error,
          message: 'Contract build error',
        };
      }
      this.logger.log(`Docker build finished without errors - ${contractName}`);
      this.logger.log(
        `Using temporary folder: ${temporaryFolder.name}/${contractName}`,
      );

      const contractSourceFilePath = `${temporaryFolder.name}/${contractName}/${contractName}-${contractVersion}.source.json`;

      const tempContractName = contractNameVariant || contractName;
      const codeHashFilePath = `${temporaryFolder.name}/${contractName}/${tempContractName}.codehash.txt`;
      const contractAbiFileSourcePath = `${temporaryFolder.name}/${contractName}/${tempContractName}.abi.json`;

      const contractSource = await readFile(contractSourceFilePath);
      const codeHash = await readFile(codeHashFilePath);
      const contractAbiFile = await readFile(contractAbiFileSourcePath);

      this.logger.log(`Contract source read from ${contractSourceFilePath}`);
      this.logger.log(`Code hash read from ${codeHashFilePath} - ${codeHash}`);
      this.logger.log(
        `Contract ABI file read from ${contractAbiFileSourcePath}`,
      );

      let apiResponse;
      try {
        apiResponse = await this.apiService.get(
          `${this.commonConfigurationService.config.urls.api}/accounts/${contractAddress}`,
        );
      } catch (error: any) {
        this.logger.error(
          `Error fetching account data for contract ${contractAddress}, error: ${error.message}`,
        );
        throw new InternalServerErrorException(
          `Failed to fetch account data for contract ${contractAddress}`,
        );
      }

      const remoteCodeHash = apiResponse.data?.codeHash;
      if (!remoteCodeHash) {
        this.logger.log(`No remote code hash for contract ${contractAddress}`);
        throw new BadRequestException(
          'Could not retrieve code hash for the contract.',
        );
      }
      const hexRemoteCodeHash = Buffer.from(remoteCodeHash, 'base64').toString(
        'hex',
      );

      const localData = await this.getContractVerifierModel(contractAddress);
      if (
        localData &&
        localData.codeHash === codeHash.toString() &&
        hexRemoteCodeHash === localData.codeHash
      ) {
        await this.changeContractVerifierStatusTo(
          contractAddress,
          ContractVerifierStatus.success,
        );
        this.logger.log(
          `${ContractVerifierStatus.success} - ${localData.codeHash} - ${hexRemoteCodeHash}`,
        );
        return {
          status: ContractVerifierStatus.success,
        };
      }

      const source = JSON.stringify({
        abi: JSON.parse(contractAbiFile.toString()),
        contract: JSON.parse(contractSource.toString()),
      });

      if (hexRemoteCodeHash !== codeHash.toString()) {
        this.logger.log(
          `Source code hashes do not match - ${codeHash.toString()} - ${hexRemoteCodeHash}`,
        );
        return {
          status: ContractVerifierStatus.error,
          message: 'Source code hashes do not match',
        };
      }

      const pinataData: PinataUpload | undefined =
        await this.pinataService.uploadContent(JSON.parse(source));
      if (!pinataData) {
        this.logger.log('Could not upload to IPFS');
        return {
          status: ContractVerifierStatus.error,
          message: 'Could not upload to IPFS',
        };
      }

      const code = new ContractVerifierSource();
      code.contract = Buffer.from(source).toString('base64');

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

      this.logger.log(ContractVerifierStatus.success);
      return {
        status: ContractVerifierStatus.success,
      };
    } finally {
      temporaryFile.removeCallback();
      temporaryFolder.removeCallback();
    }
  }
}
