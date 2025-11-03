import { WorkerService } from "@libs/services/worker";
import { OnQueueError, OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";


@Processor('verifierQueue')
export class VerifierQueueService {
  private readonly logger: Logger;

  constructor(
    private readonly worker: WorkerService,
  ) {
    this.logger = new Logger(VerifierQueueService.name);
  }

  @Process({ name: 'validate', concurrency: 1 })
  onVerifyRequest(job: Job<any>) {
    this.logger.log({ type: 'consumer', jobId: job.id, identifier: job.data.data.validate.payload.contract, attemptsMade: job.attemptsMade });
    return this.worker.workVerifier(job.data.taskId, job.data.data.validate);
  }

  @OnQueueError()
  handleError(error: Error) {
    this.logger.error('Queue error:', error.message);
  }

  @OnQueueFailed()
  handleFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id}, from queue ${job.queue.name} , ${job.data} failed: ${error.message}.`, error.stack);
  }
}
