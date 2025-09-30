import { AddressUtils } from "@elrondnetwork/erdnest";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import fs from "fs";
import sanitizeFilename from "sanitize-filename";
import { ApiConfigService } from "src/common/api.config.service";
import { ApiService } from "src/common/api.service";
import { EnvironmentEnum } from "src/common/entities/environment.enum";
import { PersistenceService } from "src/common/persistence.service";
import { PinataUpload } from "src/common/pinata/entities/pinata.upload";
import { PinataService } from "src/common/pinata/pinata.service";
import { DockerRunner } from "src/common/utils/docker.runner";
import { checkPayloadSignature } from "src/common/utils/signature";
import { Verifier } from "src/endpoints/verifier/entities/verifier";
import * as tmp from "tmp";
import { promisify } from "util";
import { ContractVerifierStatus } from "./entities/common";
import { ContractVerifier } from "./entities/contract.verifier";
import { VerifierDeletion } from "./entities/verifier.deletion";
import { VerifierCodeHashResponse } from "./entities/verifier.hash.response";
import { VerifierResponse } from "./entities/verifier.response";


const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

@Injectable()
export class VerifierService {
  private readonly dockerRunner: DockerRunner;
  private readonly logger: Logger;

  constructor(
    //@ts-ignore
    private readonly apiConfigurationService: ApiConfigService,
    private readonly persistenceService: PersistenceService,
    private readonly pinataService: PinataService,
    private readonly apiService: ApiService
  ) {
    this.dockerRunner = new DockerRunner();
    this.logger = new Logger(VerifierService.name);
  }

  public async getContractVerifier(address: string, dependencyDepth: number = 0, includeTestFiles: any = false): Promise<ContractVerifier> {

    if (!AddressUtils.isAddressValid(address)) {
      throw new NotFoundException();
    }

    includeTestFiles = includeTestFiles === 'true';

    // If we want to return all deps, include also test files
    if (dependencyDepth === -1) {
      includeTestFiles = true;
    }

    const currentEnvironment = this.apiConfigurationService.getEnvironment();
    const data = await this.persistenceService.getContractVerifier(address);
    const apiResponse = await this.apiService.get(`${this.apiConfigurationService.getApiUrl(currentEnvironment)}/accounts/${address}`);

    const remoteCodeHash = apiResponse.codeHash;

    if (!data || !remoteCodeHash) {
      if (!remoteCodeHash) {
        this.logger.log(`No remote code hash for address ${address}`);
      }
      if (!data) {
        this.logger.log(`No local data for address ${address}`);
      }
      throw new NotFoundException();
    }

    const returnedData: ContractVerifier = data as any;

    if (data.codeHash !== Buffer.from(remoteCodeHash, 'base64').toString('hex')) {
      return { status: ContractVerifierStatus.byteCodeChangedSinceLastVerification };
    }

    if (data.source) {
      returnedData.source = JSON.parse(Buffer.from(data.source, 'base64').toString());
    }

    // Filter result by depth
    if (returnedData.source?.contract && dependencyDepth > -1) {
      returnedData.source.contract.entries = returnedData.source.contract.entries.filter((entry: any) => {

        // Filter out everything that is under /wasm/src*
        if (entry.path.startsWith('wasm/src/') || entry.path.includes('/wasm/src/')) {
          return false;
        }

        // Support old contract verifications without dependecy depth
        if (typeof entry.dependencyDepth === "undefined") {
          return true;
        }

        if ((typeof entry.dependencyDepth !== "undefined") && entry.dependencyDepth <= dependencyDepth) {
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

  public async getVerifiedContracts(): Promise<string[]> {
    const data = await this.persistenceService.getVerifiedContracts(['address']);

    return data.map(contract => contract.address || '');
  }


  public async getContractVerifierCodeHash(address: string): Promise<VerifierCodeHashResponse> {
    if (!AddressUtils.isAddressValid(address)) {
      throw new NotFoundException();
    }

    const data = await this.persistenceService.getContractVerifier(address);

    if (!data) {
      throw new NotFoundException();
    }

    return { codeHash: data.codeHash || '' };
  }

  public async removeContractVerifierSource(body: VerifierDeletion): Promise<any> {

    const currentEnvironment = this.apiConfigurationService.getEnvironment();
    const { ownerAddress } = await this.apiService.get(`${this.apiConfigurationService.getApiUrl(currentEnvironment)}/accounts/${body.payload.contract}`);

    if (!checkPayloadSignature(body.signature, body.payload, ownerAddress)) {
      return {
        status: ContractVerifierStatus.error,
        message: 'Invalid signature',
      };
    }

    const contractAddress = body.payload.contract;
    return this.persistenceService.deleteContractVerifier(
      contractAddress,
    );
  }

  private async changeContractVerifierStatusTo(contractAddress: string, status: ContractVerifierStatus) {
    return this.persistenceService.saveContractVerifier(
      contractAddress,
      {
        status: status,
      }
    );
  }

  public async validate(validateBody: Verifier, environment: EnvironmentEnum): Promise<VerifierResponse> {
    this.logger.log(`Verifier process started for contract ${validateBody.payload.contract}`);

    const sourceCode = validateBody.payload.sourceCode;
    const contractName = sanitizeFilename(sourceCode.name || sourceCode.metadata.contractName);
    const contractNameVariant = validateBody.payload.contractVariant ? sanitizeFilename(validateBody.payload.contractVariant) : undefined;
    const contractVersion = sourceCode.version || sourceCode.metadata.contractVersion;
    const dockerImage = validateBody.payload.dockerImage;

    if (!dockerImage || (dockerImage && dockerImage.split(':')[0] !== 'multiversx/sdk-rust-contract-builder')) {
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

    this.logger.log(`Write contract received source code temporary to: ${temporaryFile.name}`);

    try {
      await writeFile(temporaryFile.fd, JSON.stringify(sourceCode));

      const localData = await this.persistenceService.getContractVerifier(contractAddress);

      this.logger.log('Execute docker');
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
        this.logger.log(`Contract built error ${e}`, e);
        return {
          status: ContractVerifierStatus.error,
          message: 'Contract build error',
        };
      }
      this.logger.log(`Docker build finished without errors - ${contractName}`);
      this.logger.log(`Using temporary folder: ${temporaryFolder.name}/${contractName}`);

      const contractSourceFilePath = `${temporaryFolder.name}/${contractName}/${contractName}-${contractVersion}.source.json`;

      const tempContractName = contractNameVariant || contractName;
      const codeHashFilePath = `${temporaryFolder.name}/${contractName}/${tempContractName}.codehash.txt`;
      const contractAbiFileSourcePath = `${temporaryFolder.name}/${contractName}/${tempContractName}.abi.json`;

      const contractSource = await readFile(contractSourceFilePath);
      const codeHash = await readFile(codeHashFilePath);
      const contractAbiFile = await readFile(contractAbiFileSourcePath);

      this.logger.log(`Contract source read from ${contractSourceFilePath}`);
      this.logger.log(`Code hash read from ${codeHashFilePath} - ${codeHash}`);
      this.logger.log(`Contract ABI file read from ${contractAbiFileSourcePath}`);

      // check hashcode
      const apiResponse = await this.apiService.get(`${this.apiConfigurationService.getApiUrl(environment)}/accounts/${contractAddress}`);
      const remoteCodeHash = apiResponse.codeHash;
      const hexRemoteCodeHash = Buffer.from(remoteCodeHash, 'base64').toString('hex');

      if (localData && localData.codeHash === codeHash.toString() && hexRemoteCodeHash === localData.codeHash) {
        await this.changeContractVerifierStatusTo(contractAddress, ContractVerifierStatus.success);
        this.logger.log(`${ContractVerifierStatus.success} - ${localData.codeHash} - ${hexRemoteCodeHash}`);
        return {
          status: ContractVerifierStatus.success,
        };
      }

      const source = JSON.stringify({
        abi: JSON.parse(contractAbiFile.toString()),
        contract: JSON.parse(contractSource.toString()),
      });

      const pinataData: PinataUpload | undefined = await this.pinataService.uploadContent(JSON.parse(source));

      if (hexRemoteCodeHash !== codeHash.toString()) {
        this.logger.log(`Source code hashes do not match - ${codeHash.toString()} - ${hexRemoteCodeHash}`);
        return {
          status: ContractVerifierStatus.error,
          message: 'Source code hashes do not match',
        };
      }

      if (!pinataData) {
        this.logger.log('Could not upload to IPFS');
        return {
          status: ContractVerifierStatus.error,
          message: 'Could not upload to IPFS',
        };
      }

      await this.persistenceService.saveContractVerifier(
        contractAddress,
        {
          source: Buffer.from(source).toString('base64'),
          codeHash: codeHash.toString(),
          ipfsFileHash: pinataData.hash,
          status: ContractVerifierStatus.success,
          dockerImage: dockerImage,
        }
      );
      this.logger.log(`Contract verifier saved to database - contract: ${contractAddress} - pinata: ${pinataData.hash} - dockerImage: ${dockerImage}`);

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
