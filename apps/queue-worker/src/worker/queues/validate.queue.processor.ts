import { WorkerService } from '@libs/services/worker';
import { OnQueueError, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

@Processor('validateQueue')
export class ValidateQueueProcessor {
  private readonly logger: Logger;

  constructor(private readonly worker: WorkerService) {
    this.logger = new Logger(ValidateQueueProcessor.name);
  }

  @Process({ name: 'validate', concurrency: 1 })
  async onValidateRequest(job: Job<any>) {
    this.logger.log({
      type: 'consumer',
      jobId: job.id,
      identifier: job.data.data.validate.payload.contract,
      attemptsMade: job.attemptsMade,
    });
    return await this.worker.workVerifier(job.data.taskId, job.data.data.validate);
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
