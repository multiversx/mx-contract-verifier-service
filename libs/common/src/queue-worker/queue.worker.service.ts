import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { Verifier, VerifierFromExisting } from '../dtos';

@Injectable()
export class QueueWorkerService {
  private readonly logger: Logger;

  constructor(
    @InjectQueue('validateQueue') private validateQueue: Queue,
    @InjectQueue('validateFromExistingQueue') private validateFromExistingQueue: Queue,
  ) {
    this.logger = new Logger(QueueWorkerService.name);
  }

  async addValidateJobIntoQueue(type: string, taskId: string, data: Verifier) {
    const job = await this.validateQueue.add(
      type,
      { taskId, data },
      {
        jobId: taskId,
        attempts: 1,
      },
    );
    this.logger.log({
      type: 'producer',
      jobId: job.id,
      identifier: job.data.data.validate.payload.contract,
    });
  }

  async addValidateFromExistingJobIntoQueue(
    type: string,
    taskId: string,
    data: VerifierFromExisting,
  ) {
    const job = await this.validateFromExistingQueue.add(
      type,
      { taskId, data },
      {
        jobId: taskId,
        attempts: 1,
      },
    );
    this.logger.log({
      type: 'producer',
      jobId: job.id,
      identifier: job.data.data.validateFromExisting.contract,
    });
  }
}
