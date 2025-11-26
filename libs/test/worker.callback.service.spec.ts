import { CacheService } from '@multiversx/sdk-nestjs-cache';
import { Constants } from '@multiversx/sdk-nestjs-common';
import { Test, TestingModule } from '@nestjs/testing';
import { ErrorVerifierResponse, SuccessfulVerifierResponse, TaskStatus } from '../common/src/dtos';
import { WorkerCallbackService } from '../services/src/worker/worker.callback.service';
import { dockerImage, mockAddress, mockCodeHash, pinataHash } from './mocks/verified.contract.mock';

describe('WorkerCallbackService', () => {
  let service: WorkerCallbackService;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    cacheService = {
      setRemote: jest.fn(),
      getRemote: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkerCallbackService,
        {
          provide: CacheService,
          useValue: cacheService,
        },
      ],
    }).compile();

    service = module.get<WorkerCallbackService>(WorkerCallbackService);
  });

  describe('update task status', () => {
    it('should throw error when taskId is missing from cache', async () => {
      const taskId = 'test-task-123';
      const status = TaskStatus.started;

      await expect(service.updateStatus(taskId, status)).rejects.toThrow(
        `Could not identify task with identifier '${taskId}'.`,
      );
    });

    it('should update task status in cache', async () => {
      const taskId = 'test-task-123';
      const status = TaskStatus.started;

      // Mock Date.now() to return a fixed timestamp
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-11-05T15:26:11.967Z'));

      // Mock the cache service call
      cacheService.getRemote.mockResolvedValue({ status: TaskStatus.queued });

      await service.updateStatus(taskId, status);

      expect(cacheService.setRemote).toHaveBeenCalledWith(
        `task:${taskId}`,
        {
          status,
          started: new Date('2025-11-05T15:26:11.967Z'),
        },
        Constants.oneHour(),
      );

      // Restore real timers
      jest.useRealTimers();
    });

    it('should handle task status transition from started to finished', async () => {
      const taskId = 'test-task-123';
      const result = new SuccessfulVerifierResponse({
        address: mockAddress,
        codeHash: mockCodeHash,
        ipfsFileHash: pinataHash,
        dockerImage: dockerImage,
       });

      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-11-05T15:26:11.967Z'));

      cacheService.getRemote.mockResolvedValue({
        status: TaskStatus.started,
        started: new Date('2025-11-05T15:26:11.967Z'),
      });

      await service.updateStatus(taskId, TaskStatus.finished, result);

      expect(cacheService.setRemote).toHaveBeenCalledWith(
        `task:${taskId}`,
        {
          status: TaskStatus.finished,
          started: new Date('2025-11-05T15:26:11.967Z'),
          finished: new Date('2025-11-05T15:26:11.967Z'),
          result,
        },
        Constants.oneHour(),
      );

      jest.useRealTimers();
    });

    it('should handle task status transition to error with error details', async () => {
      const taskId = 'test-task-123';
      const errorDetails = new ErrorVerifierResponse({
        message: 'Verification failed',
        error: 'BadRequestError',
        statusCode: 400,
      });

      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-11-05T15:26:11.967Z'));

      cacheService.getRemote.mockResolvedValue({
        status: TaskStatus.started,
        started: new Date('2025-11-05T15:26:11.967Z'),
      });

      await service.updateStatus(taskId, TaskStatus.error, errorDetails);

      expect(cacheService.setRemote).toHaveBeenCalledWith(
        `task:${taskId}`,
        {
          status: TaskStatus.error,
          started: new Date('2025-11-05T15:26:11.967Z'),
          finished: new Date('2025-11-05T15:26:11.967Z'),
          result: errorDetails,
        },
        Constants.oneHour(),
      );

      jest.useRealTimers();
    });
  });
});
