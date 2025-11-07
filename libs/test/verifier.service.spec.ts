import { ApiService } from '@multiversx/sdk-nestjs-http';
import { Logger, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CommonConfigService, ContractVerifierStatus } from "../common/src";
import { ContractVerifierRepository } from '../database/src';
import { PinataService } from '../services/src/pinata/pinata.service';
import { VerifierService } from "../services/src/verifier";

describe('VerifierService', () => {
    let service: VerifierService;
    let commonConfigService: jest.Mocked<CommonConfigService>;
    let contractVerifierRepository: jest.Mocked<ContractVerifierRepository>;
    let pinataService: jest.Mocked<PinataService>;
    let apiService: jest.Mocked<ApiService>;

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
                    api: 'https://devnet-api.multiversx.com'
                }
            }
        } as any;

        contractVerifierRepository = {
            save: jest.fn(),
            findOne: jest.fn(),
            findVerified: jest.fn(),
            delete: jest.fn()
        } as any;

        pinataService = {
            uploadContent: jest.fn()
        } as any;

        apiService = {
            get: jest.fn()
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VerifierService,
                {
                    provide: CommonConfigService,
                    useValue: commonConfigService
                },
                {
                    provide: ContractVerifierRepository,
                    useValue: contractVerifierRepository
                },
                {
                    provide: PinataService,
                    useValue: pinataService
                },
                {
                    provide: ApiService,
                    useValue: apiService
                }
            ],
        }).compile();

        service = module.get<VerifierService>(VerifierService);
    });

    it('should throw error when contract is not found - getContractVerifier', async () => {
        contractVerifierRepository.findOne.mockResolvedValue(null);

        apiService.get.mockResolvedValue({
            data: {}
        });

        await expect(service.getContractVerifier(mockAddress)).rejects.toThrow(
            new NotFoundException('Verified contract not found for the given address.')
        );
    });

    it('should get contract verifier info', async () => {
        contractVerifierRepository.findOne.mockResolvedValue(verifiedContractMock);

        apiService.get.mockResolvedValue({
            data: {
                codeHash: Buffer.from(mockCodeHash, 'hex').toString('base64')
            }
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
                        "targetPlatform": "linux/amd64"
                    }
                }
            }
        })
    });

    it('should get verified contracts', async () => {
        contractVerifierRepository.findVerified.mockResolvedValue([verifiedContractMock]);

        const result = await service.getVerifiedContracts();
        expect(result).toEqual([mockAddress]);
    });

    it('should throw error when contract is not found - getContractVerifierCodeHash', async () => {
        contractVerifierRepository.findOne.mockResolvedValue(null);

        await expect(service.getContractVerifierCodeHash(mockAddress)).rejects.toThrow(
            new NotFoundException('Verified contract not found for the given address.')
        );
    });

    it('should get codeHash of the verified contract', async () => {
        contractVerifierRepository.findOne.mockResolvedValue(verifiedContractMock);

        const result = await service.getContractVerifierCodeHash(mockAddress);
        expect(result).toEqual({ codeHash: mockCodeHash });
    });

    it('should throw could not determine owner address - delete contract verifier', async () => {
        contractVerifierRepository.findOne.mockResolvedValue(verifiedContractMock);

        apiService.get.mockResolvedValue({
            data: {}
        });

        const requestBody = {
            'signature': '9cf0bfecf402a73c37733e78780bd4ddd3fec7f97831faf91b173a7715ce5822053ac20329fc004272d22e284a10da6f057df5a7783b11cfda1c90163d66b60f',
            'payload': {
                'contract': 'erd1qqqqqqqqqqqqqpgqvxzjqasv3jsu5kxtk8ergnqdhuk3vfmnd8ss3hzc3q',
                'codeHash': '7f7376f37a9f809a1a9b21b60a2a9afe7c9d22ab65807324f537ab3696110a58'
            }
        };

        const result = await service.removeContractVerifierSource(requestBody);
        expect(result).toEqual({
            status: ContractVerifierStatus.error,
            message: 'Failed to remove contract verifier source due to internal error.',
        });
    });
});
