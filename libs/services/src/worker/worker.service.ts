import {
  TaskStatus,
  Verifier
} from '@libs/common';
import { VerifierService } from '@libs/services/verifier';
import {
  Injectable,
  Logger
} from '@nestjs/common';
import AsyncLock from "async-lock";
import { WorkerCallbackService } from './worker.callback.service';

@Injectable()
export class WorkerService {
  private readonly lock: AsyncLock;
  private readonly logger: Logger;

  constructor(
    private readonly verifierService: VerifierService,
    private readonly workerCallbackService: WorkerCallbackService
  ) {
    this.lock = new AsyncLock();
    this.logger = new Logger("Worker");
  }

  async workVerifier(taskId: string, validate: Verifier): Promise<void> {
    await this.work(taskId, async () => await this.verifierService.validate(validate));
  }

  private async work<T>(taskId: string, promise: () => Promise<T>): Promise<T> {
    this.updateTask(taskId, TaskStatus.queued);

    return await this.lock.acquire('task', async done => {
      try {
        this.updateTask(taskId, TaskStatus.started);

        const result = await promise();

        this.updateTask(taskId, TaskStatus.finished, result);
        done(undefined, result);
      } catch (error: any) {
        this.updateTask(taskId, TaskStatus.error, error.response?.errors);
        done(error);
      }
    });
  }

  private async updateTask(taskIdentifier: string, status: TaskStatus, result?: any) {
    this.logger.log(`Updating task ${taskIdentifier} with status ${TaskStatus[status]}`);
    await this.workerCallbackService.updateStatus(taskIdentifier, status, result);
  }
}
