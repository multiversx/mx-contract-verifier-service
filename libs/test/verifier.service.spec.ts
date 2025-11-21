jest.mock('fs', () => {
    const actualFs = jest.requireActual('fs');
    return {
        ...actualFs,
        writeFile: jest.fn((_fd, _data, cb) => cb(null)),
        readFile: jest.fn((path, cb) => {
            if (path.includes('.source.json')) {
                cb(null, Buffer.from(JSON.stringify({ schemaVersion: "2.0.0", metadata: { contractName: "adder" } })));
            } else if (path.includes('.codehash.txt')) {
                cb(null, Buffer.from('7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58'));
            } else if (path.includes('.abi.json')) {
                cb(null, Buffer.from(JSON.stringify({ name: "adder", methods: [] })));
            } else {
                cb(new Error('File not found'));
            }
        }),
        promises: {
            writeFile: jest.fn(() => Promise.resolve(undefined)),
            readFile: jest.fn((path) => {
                if (path.includes('.source.json')) {
                    return Buffer.from(JSON.stringify({ schemaVersion: "2.0.0", metadata: { contractName: "adder" } }));
                } else if (path.includes('.codehash.txt')) {
                    return Buffer.from('7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58');
                } else if (path.includes('.abi.json')) {
                    return Buffer.from(JSON.stringify({ name: "adder", methods: [] }));
                } else {
                    throw new Error('File not found');
                }
            }),
        },
    };
});

import { CacheService } from '@multiversx/sdk-nestjs-cache';
import { ApiService } from '@multiversx/sdk-nestjs-http';
import { BadRequestException, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CommonConfigService, ContractVerifierStatus } from "../common/src";
import { ContractVerifierRepository } from '../database/src';
import { DockerRunner } from '../services/src/docker/docker.runner';
import { PinataService } from '../services/src/pinata/pinata.service';
import { VerifierService } from "../services/src/verifier";
import { validatePayloadMock } from './mocks/validate.payload.mock';

describe('VerifierService', () => {
    let service: VerifierService;
    let commonConfigService: jest.Mocked<CommonConfigService>;
    let contractVerifierRepository: jest.Mocked<ContractVerifierRepository>;
    let pinataService: jest.Mocked<PinataService>;
    let apiService: jest.Mocked<ApiService>;
    let dockerRunner: jest.Mocked<DockerRunner>;
    let cacheService: jest.Mocked<CacheService>;

    const mockAddress = 'erd1qqqqqqqqqqqqqpgqvxzjqasv3jsu5kxtk8ergnqdhuk3vfmnd8ss3hzc3q';
    const mockCodeHash = '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58';
    const pinataHash = "QmR52Y13ZQbjnETjHsG6hLA7fgidyrWt1JVQDp6Ti1aD7N";
    const verifiedContractMock = {
            address: mockAddress,
            codeHash: mockCodeHash,
            status: ContractVerifierStatus.success,
            source: {
                abi: '',
                contract: 'eyJzY2hlbWFWZXJzaW9uIjoiMi4wLjAiLCJtZXRhZGF0YSI6eyJjb250cmFjdE5hbWUiOiJhZGRlciIsImNvbnRyYWN0VmVyc2lvbiI6IjAuMC4wIiwiYnVpbGRNZXRhZGF0YSI6eyJ2ZXJzaW9uUnVzdCI6IjEuODYuMCIsInZlcnNpb25TY1Rvb2wiOiIwLjU3LjEiLCJ2ZXJzaW9uV2FzbU9wdCI6IjAuMTE2LjEiLCJ0YXJnZXRQbGF0Zm9ybSI6ImxpbnV4L2FtZDY0In19fQ==',
            },
            ipfsFileHash: pinataHash,
            dockerImage: 'multiversx/sdk-rust-contract-builder:v10.0.0',
        };

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
            new NotFoundException('Verified contract not found for address: erd1qqqqqqqqqqqqqpgqvxzjqasv3jsu5kxtk8ergnqdhuk3vfmnd8ss3hzc3q')
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
            codeHash: mockCodeHash,
            status: ContractVerifierStatus.success,
            ipfsFileHash: pinataHash,
            dockerImage: 'multiversx/sdk-rust-contract-builder:v10.0.0',
            source: {
                "schemaVersion": "2.0.0",
                "metadata": {
                    "contractName": "adder",
                    "contractVersion": "0.0.0",
                    "buildMetadata": {
                        "versionRust": "1.86.0",
                        "versionScTool": "0.57.1",
                        "versionWasmOpt": "0.116.1",
                        "targetPlatform": "linux/amd64",
                    },
                },
            },
        });
    });

    it('should return changed status for contract verifier info', async () => {
        contractVerifierRepository.findOne.mockResolvedValue(verifiedContractMock);
        cacheService.getOrSet.mockImplementation((_key, callback) => {
            return Promise.resolve(callback());
        });

        apiService.get.mockResolvedValue({
            data: {
                codeHash: Buffer.from('dc18de0c20d3c34b3f07e70f9f68b4db49063acad5632d774f3ab259f56fd11d', 'hex').toString('base64'),
            },
        });

        const result = await service.getContractVerifier(mockAddress);

        expect(result).toEqual({
            codeHash: mockCodeHash,
            status: ContractVerifierStatus.byteCodeChangedSinceLastVerification,
            ipfsFileHash: pinataHash,
            dockerImage: 'multiversx/sdk-rust-contract-builder:v10.0.0',
            source: {
                "schemaVersion": "2.0.0",
                "metadata": {
                    "contractName": "adder",
                    "contractVersion": "0.0.0",
                    "buildMetadata": {
                        "versionRust": "1.86.0",
                        "versionScTool": "0.57.1",
                        "versionWasmOpt": "0.116.1",
                        "targetPlatform": "linux/amd64",
                    },
                },
            },
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
            new NotFoundException('Verified contract not found for address: erd1qqqqqqqqqqqqqpgqvxzjqasv3jsu5kxtk8ergnqdhuk3vfmnd8ss3hzc3q')
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
            'signature': '9cf0bfecf402a73c37733e78780bd4ddd3fec7f97831faf91b173a7715ce5822053ac20329fc004272d22e284a10da6f057df5a7783b11cfda1c90163d66b60f',
            'payload': {
                'contract': 'erd1qqqqqqqqqqqqqpgqvxzjqasv3jsu5kxtk8ergnqdhuk3vfmnd8ss3hzc3q',
                'codeHash': '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
            },
        };

        await expect(service.removeContractVerifierSource(requestBody)).rejects.toThrow(
            new BadRequestException('Could not determine owner address for the contract.')
        );
    });

    it('should return invalid signature - delete contract verifier', async () => {
        apiService.get.mockResolvedValue({
            data: {
                ownerAddress: 'erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th',
            },
        });

        const requestBody = {
            'signature': '9cf0bfecf402a73c37733e78780bd4ddd3fec7f97831faf91b173a7715ce5822053ac20329fc004272d22e284a10da6f057df5a7783b11cfda1c90163d66b60a', // altered signature
            'payload': {
                'contract': 'erd1qqqqqqqqqqqqqpgqvxzjqasv3jsu5kxtk8ergnqdhuk3vfmnd8ss3hzc3q',
                'codeHash': '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
            },
        };

        await expect(service.removeContractVerifierSource(requestBody)).rejects.toThrow(
            new UnauthorizedException('Invalid signature')
        );
    });

    it('should throw error for not verified contract - delete contract verifier', async () => {
        const spy = jest.spyOn(service as any, 'checkPayloadSignature').mockImplementation(() => true);

        contractVerifierRepository.findOne.mockResolvedValue(null);

        apiService.get.mockResolvedValue({
            data: {
                ownerAddress: 'erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zp6hypefsdd8ssycr6th',
            },
        });

        const requestBody = {
            'signature': 'd0d16d94bb8c3b391c69d370fd3ca1e1fbf757f68ce543c1ed4ab7fe3c1208731b797342a76aea94b9cabc39ceb4afb7ac5b7e35475c44f52bfd938f1a5c8b0d',
            'payload': {
                'contract': 'erd1qqqqqqqqqqqqqpgq8uzcu905yt6xk7k6eg9gnhhxp6gk9swnd8sspla0v4',
                'codeHash': '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
            },
        };

        await expect(service.removeContractVerifierSource(requestBody)).rejects.toThrow(
            new NotFoundException('Verified contract not found for address: erd1qqqqqqqqqqqqqpgq8uzcu905yt6xk7k6eg9gnhhxp6gk9swnd8sspla0v4')
        );

        spy.mockRestore();
    });

    it('should delete contract verifier', async () => {
        const spy = jest.spyOn(service as any, 'checkPayloadSignature').mockImplementation(() => true);

        cacheService.getOrSet.mockImplementation((_key, callback) => {
            return Promise.resolve(callback());
        });

        contractVerifierRepository.findOne.mockResolvedValue(verifiedContractMock);
        contractVerifierRepository.delete.mockResolvedValue(verifiedContractMock);

        apiService.get.mockResolvedValue({
            data: {
                ownerAddress: 'erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zp6hypefsdd8ssycr6th',
            },
        });

        const requestBody = {
            'signature': '9cf0bfecf402a73c37733e78780bd4ddd3fec7f97831faf91b173a7715ce5822053ac20329fc004272d22e284a10da6f057df5a7783b11cfda1c90163d66b60f',
            'payload': {
                'contract': 'erd1qqqqqqqqqqqqqpgqvxzjqasv3jsu5kxtk8ergnqdhuk3vfmnd8ss3hzc3q',
                'codeHash': '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
            },
        };

        const result = await service.removeContractVerifierSource(requestBody);
        expect(result).toEqual({
            codeHash: '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58',
            source: 'eyJzY2hlbWFWZXJzaW9uIjoiMi4wLjAiLCJtZXRhZGF0YSI6eyJjb250cmFjdE5hbWUiOiJhZGRlciIsImNvbnRyYWN0VmVyc2lvbiI6IjAuMC4wIiwiYnVpbGRNZXRhZGF0YSI6eyJ2ZXJzaW9uUnVzdCI6IjEuODYuMCIsInZlcnNpb25TY1Rvb2wiOiIwLjU3LjEiLCJ2ZXJzaW9uV2FzbU9wdCI6IjAuMTE2LjEiLCJ0YXJnZXRQbGF0Zm9ybSI6ImxpbnV4L2FtZDY0In19fQ==',
            status: 'success',
            ipfsFileHash: 'QmR52Y13ZQbjnETjHsG6hLA7fgidyrWt1JVQDp6Ti1aD7N',
            dockerImage: 'multiversx/sdk-rust-contract-builder:v10.0.0',
        });

        spy.mockRestore();
    });

    it('should throw invalid docker image', async () => {
        // remove docker image from mock
        const validatePayloadMockWithoutDockerImage = JSON.parse(JSON.stringify(validatePayloadMock));
        validatePayloadMockWithoutDockerImage.payload.dockerImage = '';

        const result = await service.validate(validatePayloadMockWithoutDockerImage);
        expect(result).toEqual({
            status: "error",
            message: "Invalid docker image",
        });
    });

    it('should throw docker execution error', async () => {
        contractVerifierRepository.findOne.mockResolvedValue(verifiedContractMock);

        jest.spyOn((service as any).dockerRunner, 'exec').mockRejectedValueOnce(new Error('Docker execution failed'));

        const result = await service.validate(validatePayloadMock);
        expect(result).toEqual({
            status: "error",
            message: "Contract build error",
        });
    });

    it('should throw source code hash does not match', async () => {
        contractVerifierRepository.findOne.mockResolvedValue(verifiedContractMock);

        jest.spyOn((service as any).dockerRunner, 'exec').mockResolvedValueOnce('');

        apiService.get.mockResolvedValue({
            data: {
                codeHash: Buffer.from('7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696177777', 'hex').toString('base64'),
            },
        });

        const result = await service.validate(validatePayloadMock);
        expect(result).toEqual({
            status: "error",
            message: "Source code hashes do not match",
        });
    });

    it('should throw pinata error', async () => {
        contractVerifierRepository.findOne.mockResolvedValue(null);

        jest.spyOn((service as any).dockerRunner, 'exec').mockResolvedValueOnce('');

        apiService.get.mockResolvedValue({
            data: {
                codeHash: Buffer.from('7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58', 'hex').toString('base64'),
            },
        });

        pinataService.uploadContent.mockImplementationOnce((_content) => {
            return Promise.resolve(undefined);
        });

        const result = await service.validate(validatePayloadMock);
        expect(result).toEqual({
            status: "error",
            message: "Could not upload to IPFS",
        });
    });

    it('should validate contract', async () => {
        contractVerifierRepository.findOne.mockResolvedValue(null);
        contractVerifierRepository.save.mockResolvedValue();

        jest.spyOn((service as any).dockerRunner, 'exec').mockResolvedValueOnce('');

        apiService.get.mockResolvedValue({
            data: {
                codeHash: Buffer.from('7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58', 'hex').toString('base64'),
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
            status: "success",
        });
    });
});
