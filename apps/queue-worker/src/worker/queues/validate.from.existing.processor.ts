import { WorkerService } from '@libs/services/worker';
import { OnQueueError, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

@Processor('validateFromExistingQueue')
export class ValidateFromExistingQueueProcessor {
  private readonly logger: Logger;

  constructor(private readonly worker: WorkerService) {
    this.logger = new Logger(ValidateFromExistingQueueProcessor.name);
  }

  @Process({ name: 'validateFromExisting', concurrency: 1 })
  async onValidateFromExistingRequest(job: Job<any>) {
    this.logger.log({
      type: 'consumer',
      jobId: job.id,
      identifier: job.data.data.validateFromExisting.contract,
      attemptsMade: job.attemptsMade,
    });
    return await this.worker.workVerifierFromExisting(
      job.data.taskId,
      job.data.data.validateFromExisting,
    );
  }

  @OnQueueError()
  handleError(error: Error) {
    this.logger.error('Queue error:', error.message);
  }

  @OnQueueFailed()
  handleFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}.`, error.stack);
  }
}
