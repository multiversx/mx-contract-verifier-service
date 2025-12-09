jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    writeFile: jest.fn((_fd, _data, cb) => cb(null)),
    readFile: jest.fn((path, cb) => {
      if (path.includes('.source.json')) {
        cb(
          null,
          Buffer.from(
            JSON.stringify({
              schemaVersion: '2.0.0',
              metadata: { contractName: 'adder' },
            }),
          ),
        );
      } else if (path.includes('.codehash.txt')) {
        cb(
          null,
          Buffer.from('7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58'),
        );
      } else if (path.includes('.abi.json')) {
        cb(null, Buffer.from(JSON.stringify({ name: 'adder', methods: [] })));
      } else {
        cb(new Error('File not found'));
      }
    }),
    promises: {
      writeFile: jest.fn(() => Promise.resolve(undefined)),
      readFile: jest.fn((path) => {
        if (path.includes('.source.json')) {
          return Buffer.from(
            JSON.stringify({
              schemaVersion: '2.0.0',
              metadata: { contractName: 'adder' },
            }),
          );
        } else if (path.includes('.codehash.txt')) {
          return Buffer.from(
            '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
          );
        } else if (path.includes('.abi.json')) {
          return Buffer.from(JSON.stringify({ name: 'adder', methods: [] }));
        } else {
          throw new Error('File not found');
        }
      }),
    },
  };
});

import { CacheService } from '@multiversx/sdk-nestjs-cache';
import { ApiService } from '@multiversx/sdk-nestjs-http';
import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CommonConfigService, ContractVerifierStatus } from '../common/src';
import { ContractVerifierRepository } from '../database/src';
import { DockerRunner } from '../services/src/docker/docker.runner';
import { PinataService } from '../services/src/pinata/pinata.service';
import { VerifierService } from '../services/src/verifier';
import { validateFromExistingMock } from './mocks/validate.from.existing.mock';
import { validatePayloadMock } from './mocks/validate.payload.mock';
import {
  dockerImage,
  mockAddress,
  mockCodeHash,
  pinataHash,
  verifiedContractMock,
} from './mocks/verified.contract.mock';
import { verifiedContractInfoSourceMock } from './mocks/verified.source.mock';

describe('VerifierService', () => {
  let service: VerifierService;
  let commonConfigService: jest.Mocked<CommonConfigService>;
  let contractVerifierRepository: jest.Mocked<ContractVerifierRepository>;
  let pinataService: jest.Mocked<PinataService>;
  let apiService: jest.Mocked<ApiService>;
  let dockerRunner: jest.Mocked<DockerRunner>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    commonConfigService = {
      config: {
        urls: {
          api: 'https://devnet-api.multiversx.com',
        },
        pinata: {
          fileStorageCdnUrl: 'https://gateway.pinata.cloud/ipfs',
        },
      },
    } as any;

    contractVerifierRepository = {
      save: jest.fn(),
      findOne: jest.fn(),
      findVerified: jest.fn(),
      findOutdated: jest.fn(),
      delete: jest.fn(),
    } as any;

    pinataService = {
      uploadContent: jest.fn(),
    } as any;

    apiService = {
      get: jest.fn(),
    } as any;

    dockerRunner = {
      exec: jest.fn(),
    } as any;

    cacheService = {
      getOrSet: jest.fn(),
      delete: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerifierService,
        {
          provide: CommonConfigService,
          useValue: commonConfigService,
        },
        {
          provide: ContractVerifierRepository,
          useValue: contractVerifierRepository,
        },
        {
          provide: PinataService,
          useValue: pinataService,
        },
        {
          provide: ApiService,
          useValue: apiService,
        },
        {
          provide: DockerRunner,
          useValue: dockerRunner,
        },
        {
          provide: CacheService,
          useValue: cacheService,
        },
      ],
    }).compile();

    service = module.get<VerifierService>(VerifierService);
  });

  it('should throw error when contract is not found - getContractVerifier', async () => {
    contractVerifierRepository.findOne.mockResolvedValue(null);

    apiService.get.mockResolvedValue({
      data: {},
    });

    await expect(service.getContractVerifier(mockAddress)).rejects.toThrow(
      new NotFoundException(
        'Verified contract not found for address: erd1qqqqqqqqqqqqqpgqvxzjqasv3jsu5kxtk8ergnqdhuk3vfmnd8ss3hzc3q',
      ),
    );
  });

  it('should get contract verifier info', async () => {
    contractVerifierRepository.findOne.mockResolvedValue(verifiedContractMock);
    cacheService.getOrSet.mockImplementation((_key, callback) => {
      return Promise.resolve(callback());
    });

    apiService.get.mockResolvedValue({
      data: {
        codeHash: Buffer.from(mockCodeHash, 'hex').toString('base64'),
      },
    });

    const result = await service.getContractVerifier(mockAddress);

    expect(result).toEqual({
      address: mockAddress,
      codeHash: mockCodeHash,
      status: ContractVerifierStatus.success,
      ipfsFileHash: pinataHash,
      dockerImage: 'multiversx/sdk-rust-contract-builder:v10.0.0',
      source: verifiedContractInfoSourceMock,
    });
  });

  it('should return changed status for contract verifier info', async () => {
    contractVerifierRepository.findOne.mockResolvedValue(verifiedContractMock);
    cacheService.getOrSet.mockImplementation((_key, callback) => {
      return Promise.resolve(callback());
    });

    apiService.get.mockResolvedValue({
      data: {
        codeHash: Buffer.from(
          'dc18de0c20d3c34b3f07e70f9f68b4db49063acad5632d774f3ab259f56fd11d',
          'hex',
        ).toString('base64'),
      },
    });

    const result = await service.getContractVerifier(mockAddress);

    expect(result).toEqual({
      address: mockAddress,
      codeHash: mockCodeHash,
      status: ContractVerifierStatus.byteCodeChangedSinceLastVerification,
      ipfsFileHash: pinataHash,
      dockerImage: 'multiversx/sdk-rust-contract-builder:v10.0.0',
      source: verifiedContractInfoSourceMock,
    });
  });

  it('should get verified contracts', async () => {
    contractVerifierRepository.findVerified.mockResolvedValue([verifiedContractMock]);

    const result = await service.getVerifiedContracts();
    expect(result).toEqual([mockAddress]);
  });

  it('should get outdated contracts', async () => {
    const outdatedContractMock = {
      ...verifiedContractMock,
      status: ContractVerifierStatus.byteCodeChangedSinceLastVerification,
    };
    contractVerifierRepository.findOutdated.mockResolvedValue([outdatedContractMock]);

    const result = await service.getOutdatedContracts();
    expect(result).toEqual([mockAddress]);
  });

  it('should throw error when contract is not found - getContractVerifierCodeHash', async () => {
    contractVerifierRepository.findOne.mockResolvedValue(null);

    await expect(service.getContractVerifierCodeHash(mockAddress)).rejects.toThrow(
      new NotFoundException(
        'Verified contract not found for address: erd1qqqqqqqqqqqqqpgqvxzjqasv3jsu5kxtk8ergnqdhuk3vfmnd8ss3hzc3q',
      ),
    );
  });

  it('should get codeHash of the verified contract', async () => {
    contractVerifierRepository.findOne.mockResolvedValue(verifiedContractMock);
    cacheService.getOrSet.mockImplementation((_key, callback) => {
      return Promise.resolve(callback());
    });

    const result = await service.getContractVerifierCodeHash(mockAddress);
    expect(result).toEqual({ codeHash: mockCodeHash });
  });

  it('should throw could not determine owner address - delete contract verifier', async () => {
    apiService.get.mockResolvedValue({
      data: {},
    });

    const requestBody = {
      signature:
        '9cf0bfecf402a73c37733e78780bd4ddd3fec7f97831faf91b173a7715ce5822053ac20329fc004272d22e284a10da6f057df5a7783b11cfda1c90163d66b60f',
      payload: {
        contract: 'erd1qqqqqqqqqqqqqpgqvxzjqasv3jsu5kxtk8ergnqdhuk3vfmnd8ss3hzc3q',
        codeHash: '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
      },
    };

    await expect(service.removeContractVerifierSource(requestBody)).rejects.toThrow(
      new BadRequestException('Could not determine owner address for the contract.'),
    );
  });

  it('should throw could not determine owner address for owner contract - delete contract verifier', async () => {
    apiService.get.mockResolvedValueOnce({
      data: {
        ownerAddress: 'erd1qqqqqqqqqqqqqpgqxvqq8mdy20eq6u9t09sp2tqt0f6gpyr0d8ss0xgfqz',
      },
    });

    apiService.get.mockResolvedValueOnce({
      data: {},
    });

    const requestBody = {
      signature:
        '9cf0bfecf402a73c37733e78780bd4ddd3fec7f97831faf91b173a7715ce5822053ac20329fc004272d22e284a10da6f057df5a7783b11cfda1c90163d66b60f',
      payload: {
        contract: 'erd1qqqqqqqqqqqqqpgqvxzjqasv3jsu5kxtk8ergnqdhuk3vfmnd8ss3hzc3q',
        codeHash: '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
      },
    };

    await expect(service.removeContractVerifierSource(requestBody)).rejects.toThrow(
      new BadRequestException('Could not determine owner address for the contract.'),
    );
  });

  it('should throw owner of owner contract is smart contract - delete contract verifier', async () => {
    apiService.get.mockResolvedValueOnce({
      data: {
        ownerAddress: 'erd1qqqqqqqqqqqqqpgqxvqq8mdy20eq6u9t09sp2tqt0f6gpyr0d8ss0xgfqz',
      },
    });

    apiService.get.mockResolvedValueOnce({
      data: {
        ownerAddress: 'erd1qqqqqqqqqqqqqpgqnsfdqlxg7c2nhf3hpqx53qj8uu5jre6dd8ssffmvcd',
      },
    });

    const requestBody = {
      signature:
        '9cf0bfecf402a73c37733e78780bd4ddd3fec7f97831faf91b173a7715ce5822053ac20329fc004272d22e284a10da6f057df5a7783b11cfda1c90163d66b60f',
      payload: {
        contract: 'erd1qqqqqqqqqqqqqpgqvxzjqasv3jsu5kxtk8ergnqdhuk3vfmnd8ss3hzc3q',
        codeHash: '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
      },
    };

    await expect(service.removeContractVerifierSource(requestBody)).rejects.toThrow(
      new BadRequestException(
        'Owner of the contract is a smart contract. Deletion not allowed.',
      ),
    );
  });

  it('should return invalid signature - delete contract verifier', async () => {
    apiService.get.mockResolvedValue({
      data: {
        ownerAddress: 'erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th',
      },
    });

    const requestBody = {
      signature:
        '9cf0bfecf402a73c37733e78780bd4ddd3fec7f97831faf91b173a7715ce5822053ac20329fc004272d22e284a10da6f057df5a7783b11cfda1c90163d66b60a', // altered signature
      payload: {
        contract: 'erd1qqqqqqqqqqqqqpgqvxzjqasv3jsu5kxtk8ergnqdhuk3vfmnd8ss3hzc3q',
        codeHash: '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
      },
    };

    await expect(service.removeContractVerifierSource(requestBody)).rejects.toThrow(
      new UnauthorizedException('Invalid signature'),
    );
  });

  it('should throw error for not verified contract - delete contract verifier', async () => {
    const spy = jest
      .spyOn(service as any, 'checkPayloadSignature')
      .mockImplementation(() => true);

    contractVerifierRepository.findOne.mockResolvedValue(null);

    apiService.get.mockResolvedValue({
      data: {
        ownerAddress: 'erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th',
      },
    });

    const requestBody = {
      signature:
        'd0d16d94bb8c3b391c69d370fd3ca1e1fbf757f68ce543c1ed4ab7fe3c1208731b797342a76aea94b9cabc39ceb4afb7ac5b7e35475c44f52bfd938f1a5c8b0d',
      payload: {
        contract: 'erd1qqqqqqqqqqqqqpgq8uzcu905yt6xk7k6eg9gnhhxp6gk9swnd8sspla0v4',
        codeHash: '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
      },
    };

    await expect(service.removeContractVerifierSource(requestBody)).rejects.toThrow(
      new NotFoundException(
        'Verified contract not found for address: erd1qqqqqqqqqqqqqpgq8uzcu905yt6xk7k6eg9gnhhxp6gk9swnd8sspla0v4',
      ),
    );

    spy.mockRestore();
  });

  it('should throw error if owner is SC and owner of owner is SC - delete contract verifier', async () => {
    contractVerifierRepository.findOne.mockResolvedValue(verifiedContractMock);

    apiService.get.mockResolvedValueOnce({
      data: {
        ownerAddress: 'erd1qqqqqqqqqqqqqpgq9ph6uhdl2hkq7sarxxwycr6txnx0ewcal3ts0cs79w',
      },
    });
    apiService.get.mockResolvedValueOnce({
      data: {
        ownerAddress: 'erd1qqqqqqqqqqqqqpgqq75vtleur5rg74nk4f88ql6a7ajas073l3tsc5ljc9',
      },
    });

    const requestBody = {
      signature:
        'd0d16d94bb8c3b391c69d370fd3ca1e1fbf757f68ce543c1ed4ab7fe3c1208731b797342a76aea94b9cabc39ceb4afb7ac5b7e35475c44f52bfd938f1a5c8b0d',
      payload: {
        contract: 'erd1qqqqqqqqqqqqqpgq8uzcu905yt6xk7k6eg9gnhhxp6gk9swnd8sspla0v4',
        codeHash: '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
      },
    };

    await expect(service.removeContractVerifierSource(requestBody)).rejects.toThrow(
      new UnauthorizedException(
        'Owner of the contract is a smart contract. Deletion not allowed.',
      ),
    );
  });

  it('should delete contract verifier - owner of owner contract', async () => {
    const spy = jest
      .spyOn(service as any, 'checkPayloadSignature')
      .mockImplementation(() => true);

    cacheService.getOrSet.mockImplementation((_key, callback) => {
      return Promise.resolve(callback());
    });

    contractVerifierRepository.findOne.mockResolvedValue(verifiedContractMock);
    contractVerifierRepository.delete.mockResolvedValue(verifiedContractMock);

    apiService.get.mockResolvedValueOnce({
      data: {
        ownerAddress: 'erd1qqqqqqqqqqqqqpgq9ph6uhdl2hkq7sarxxwycr6txnx0ewcal3ts0cs79w',
      },
    });
    apiService.get.mockResolvedValueOnce({
      data: {
        ownerAddress: 'erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th',
      },
    });

    const requestBody = {
      signature:
        '9cf0bfecf402a73c37733e78780bd4ddd3fec7f97831faf91b173a7715ce5822053ac20329fc004272d22e284a10da6f057df5a7783b11cfda1c90163d66b60f',
      payload: {
        contract: 'erd1qqqqqqqqqqqqqpgqvxzjqasv3jsu5kxtk8ergnqdhuk3vfmnd8ss3hzc3q',
        codeHash: '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
      },
    };

    const result = await service.removeContractVerifierSource(requestBody);
    expect(result).toEqual({
      address: mockAddress,
      codeHash: '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
      source: {
        abi: verifiedContractMock.source.abi,
        contract: verifiedContractMock.source.contract,
      },
      status: 'success',
      ipfsFileHash: 'QmR52Y13ZQbjnETjHsG6hLA7fgidyrWt1JVQDp6Ti1aD7N',
      dockerImage: 'multiversx/sdk-rust-contract-builder:v10.0.0',
    });

    spy.mockRestore();
  });

  it('should delete contract verifier', async () => {
    const spy = jest
      .spyOn(service as any, 'checkPayloadSignature')
      .mockImplementation(() => true);

    cacheService.getOrSet.mockImplementation((_key, callback) => {
      return Promise.resolve(callback());
    });

    contractVerifierRepository.findOne.mockResolvedValue(verifiedContractMock);
    contractVerifierRepository.delete.mockResolvedValue(verifiedContractMock);

    apiService.get.mockResolvedValue({
      data: {
        ownerAddress: 'erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th',
      },
    });

    const requestBody = {
      signature:
        '9cf0bfecf402a73c37733e78780bd4ddd3fec7f97831faf91b173a7715ce5822053ac20329fc004272d22e284a10da6f057df5a7783b11cfda1c90163d66b60f',
      payload: {
        contract: 'erd1qqqqqqqqqqqqqpgqvxzjqasv3jsu5kxtk8ergnqdhuk3vfmnd8ss3hzc3q',
        codeHash: '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
      },
    };

    const result = await service.removeContractVerifierSource(requestBody);
    expect(result).toEqual({
      address: mockAddress,
      codeHash: '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
      source: {
        abi: verifiedContractMock.source.abi,
        contract: verifiedContractMock.source.contract,
      },
      status: 'success',
      ipfsFileHash: 'QmR52Y13ZQbjnETjHsG6hLA7fgidyrWt1JVQDp6Ti1aD7N',
      dockerImage: 'multiversx/sdk-rust-contract-builder:v10.0.0',
    });

    spy.mockRestore();
  });

  it('should throw invalid docker image', async () => {
    apiService.get.mockResolvedValue({
      data: {
        codeHash: Buffer.from(
          '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696177777',
          'hex',
        ).toString('base64'),
      },
    });

    // remove docker image from mock
    const validatePayloadMockWithoutDockerImage = JSON.parse(
      JSON.stringify(validatePayloadMock),
    );
    validatePayloadMockWithoutDockerImage.payload.dockerImage = '';

    await expect(service.validate(validatePayloadMockWithoutDockerImage)).rejects.toThrow(
      new BadRequestException('Invalid docker image'),
    );
  });

  it('should throw docker execution error', async () => {
    contractVerifierRepository.findOne.mockResolvedValue(verifiedContractMock);
    apiService.get.mockResolvedValue({
      data: {
        codeHash: Buffer.from(
          '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696177777',
          'hex',
        ).toString('base64'),
      },
    });

    jest
      .spyOn((service as any).dockerRunner, 'exec')
      .mockRejectedValueOnce(new Error('Docker execution failed'));

    await expect(service.validate(validatePayloadMock)).rejects.toThrow(
      new InternalServerErrorException('Contract build failed'),
    );
  });

  it('should throw source code hash does not match', async () => {
    contractVerifierRepository.findOne.mockResolvedValue(verifiedContractMock);

    jest.spyOn((service as any).dockerRunner, 'exec').mockResolvedValueOnce('');

    apiService.get.mockResolvedValue({
      data: {
        codeHash: Buffer.from(
          '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696177777',
          'hex',
        ).toString('base64'),
      },
    });

    await expect(service.validate(validatePayloadMock)).rejects.toThrow(
      new BadRequestException('Source code hash does not match deployed contract'),
    );
  });

  it('should throw pinata error', async () => {
    contractVerifierRepository.findOne.mockResolvedValue(null);

    jest.spyOn((service as any).dockerRunner, 'exec').mockResolvedValueOnce('');

    apiService.get.mockResolvedValue({
      data: {
        codeHash: Buffer.from(
          '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
          'hex',
        ).toString('base64'),
      },
    });

    pinataService.uploadContent.mockImplementationOnce((_content) => {
      return Promise.resolve(undefined);
    });

    await expect(service.validate(validatePayloadMock)).rejects.toThrow(
      new InternalServerErrorException('Failed to upload contract to IPFS'),
    );
  });

  it('should validate contract', async () => {
    contractVerifierRepository.findOne.mockResolvedValue(null);
    contractVerifierRepository.save.mockResolvedValue();

    jest.spyOn((service as any).dockerRunner, 'exec').mockResolvedValueOnce('');

    apiService.get.mockResolvedValue({
      data: {
        codeHash: Buffer.from(
          '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
          'hex',
        ).toString('base64'),
      },
    });

    pinataService.uploadContent.mockImplementationOnce((_content) => {
      return Promise.resolve({
        hash: pinataHash,
        url: commonConfigService.config.pinata.fileStorageCdnUrl + '/' + pinataHash,
      });
    });

    const result = await service.validate(validatePayloadMock);
    expect(result).toEqual({
      address: mockAddress,
      codeHash: mockCodeHash,
      ipfsFileHash: pinataHash,
      dockerImage: dockerImage,
    });
  });

  it('should validate contract - already verified with same code hash', async () => {
    cacheService.getOrSet.mockImplementation((_key, callback) => {
      return Promise.resolve(callback());
    });

    contractVerifierRepository.findOne.mockResolvedValue(verifiedContractMock);

    apiService.get.mockResolvedValue({
      data: {
        codeHash: Buffer.from(
          '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
          'hex',
        ).toString('base64'),
      },
    });

    const result = await service.validate(validatePayloadMock);
    expect(result).toEqual({
      address: mockAddress,
      codeHash: mockCodeHash,
      ipfsFileHash: pinataHash,
      dockerImage: dockerImage,
    });
  });

  it('should validate from existing contract - existing already verified', async () => {
    cacheService.getOrSet.mockImplementation((_key, callback) => {
      return Promise.resolve(callback());
    });

    const contract = {
      ...verifiedContractMock,
      address: validateFromExistingMock.contract,
    };
    contractVerifierRepository.findOne.mockResolvedValue(contract);

    apiService.get.mockResolvedValue({
      data: {
        codeHash: Buffer.from(
          '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
          'hex',
        ).toString('base64'),
      },
    });

    const result = await service.validateFromExisting(validateFromExistingMock);
    expect(result).toEqual({
      address: validateFromExistingMock.contract,
      codeHash: mockCodeHash,
      ipfsFileHash: pinataHash,
      dockerImage: dockerImage,
    });
  });

  it('should validate from existing contract - existing already verified, bytecode changed', async () => {
    cacheService.getOrSet.mockImplementation((_key, callback) => {
      return Promise.resolve(callback());
    });

    const contract = {
      ...verifiedContractMock,
      address: validateFromExistingMock.contract,
    };
    contractVerifierRepository.findOne.mockResolvedValueOnce(contract);
    contractVerifierRepository.findOne.mockResolvedValueOnce(verifiedContractMock);

    apiService.get.mockResolvedValueOnce({
      data: {
        codeHash: Buffer.from(
          '0c51a67e88488825fc570e2bcb741f1f1e1d2c36b6f563980eda6f2a1b67c725',
          'hex',
        ).toString('base64'),
      },
    });

    apiService.get.mockResolvedValue({
      data: {
        codeHash: Buffer.from(
          '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
          'hex',
        ).toString('base64'),
      },
    });

    contractVerifierRepository.save.mockResolvedValue();

    const result = await service.validateFromExisting(validateFromExistingMock);
    expect(result).toEqual({
      address: validateFromExistingMock.contract,
      codeHash: mockCodeHash,
      ipfsFileHash: pinataHash,
      dockerImage: dockerImage,
    });
  });

  it('should validate from existing contract - existing not found', async () => {
    contractVerifierRepository.findOne.mockResolvedValue(null);

    await expect(service.validateFromExisting(validateFromExistingMock)).rejects.toThrow(
      new NotFoundException(
        'Verified contract not found for address: erd1qqqqqqqqqqqqqpgqvxzjqasv3jsu5kxtk8ergnqdhuk3vfmnd8ss3hzc3q',
      ),
    );
  });

  it('should validate from existing contract - codeHash changed for verified contract', async () => {
    cacheService.getOrSet.mockImplementation((_key, callback) => {
      return Promise.resolve(callback());
    });
    contractVerifierRepository.findOne.mockResolvedValue(verifiedContractMock);
    apiService.get.mockResolvedValue({
      data: {
        codeHash: Buffer.from(
          '0c51a67e88488825fc570e2bcb741f1f1e1d2c36b6f563980eda6f2a1b67c725',
          'hex',
        ).toString('base64'),
      },
    });

    await expect(service.validateFromExisting(validateFromExistingMock)).rejects.toThrow(
      new BadRequestException('Bytecode changed for existing verified contract'),
    );
  });

  it('should validate from existing contract - codeHash does not match codeHash of verified contract', async () => {
    cacheService.getOrSet.mockImplementation((_key, callback) => {
      return Promise.resolve(callback());
    });
    contractVerifierRepository.findOne.mockResolvedValueOnce(null);
    contractVerifierRepository.findOne.mockResolvedValue(verifiedContractMock);
    apiService.get.mockResolvedValueOnce({
      data: {
        codeHash: Buffer.from(mockCodeHash, 'hex').toString('base64'),
      },
    });
    apiService.get.mockResolvedValueOnce({
      data: {
        codeHash: Buffer.from(
          '0c51a67e88488825fc570e2bcb741f1f1e1d2c36b6f563980eda6f2a1b67c725',
          'hex',
        ).toString('base64'),
      },
    });

    await expect(service.validateFromExisting(validateFromExistingMock)).rejects.toThrow(
      new BadRequestException('Source code hash does not match verified contract'),
    );
  });

  it('should validate from existing contract', async () => {
    cacheService.getOrSet.mockImplementation((_key, callback) => {
      return Promise.resolve(callback());
    });

    contractVerifierRepository.findOne.mockResolvedValueOnce(null);
    contractVerifierRepository.findOne.mockResolvedValue(verifiedContractMock);

    apiService.get.mockResolvedValue({
      data: {
        codeHash: Buffer.from(mockCodeHash, 'hex').toString('base64'),
      },
    });

    contractVerifierRepository.save.mockResolvedValue();

    const result = await service.validateFromExisting(validateFromExistingMock);
    expect(result).toEqual({
      address: validateFromExistingMock.contract,
      codeHash: mockCodeHash,
      ipfsFileHash: pinataHash,
      dockerImage: dockerImage,
    });
  });
});
