import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { Verifier, VerifierFromExisting } from '../dtos';

@Injectable()
export class WorkerService {
  private readonly logger: Logger;

  constructor(@InjectQueue('verifierQueue') private verifierQueue: Queue) {
    this.logger = new Logger(WorkerService.name);
  }

  async addVerifierJobIntoQueue(type: string, taskId: string, data: Verifier) {
    const job = await this.verifierQueue.add(
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

  async addVerifierFromExistingJobIntoQueue(
    type: string,
    taskId: string,
    data: VerifierFromExisting,
  ) {
    const job = await this.verifierQueue.add(
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
