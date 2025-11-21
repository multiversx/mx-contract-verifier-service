import {
  ErrorVerifierResponse,
  SuccessfulVerifierResponse,
  TaskStatus,
  Verifier,
} from '@libs/common';
import {
  Injectable,
} from '@nestjs/common';
import AsyncLock from "async-lock";
import { VerifierService } from '../verifier';
import { WorkerCallbackService } from './worker.callback.service';

@Injectable()
export class WorkerService {
  private readonly lock: AsyncLock;

  constructor(
    private readonly verifierService: VerifierService,
    private readonly workerCallbackService: WorkerCallbackService,
  ) {
    this.lock = new AsyncLock();
  }

  async workVerifier(taskId: string, validate: Verifier): Promise<void> {
    try {
      await this.work(taskId, async () => await this.verifierService.validate(validate));
    } catch (error: any) {
      console.error(`Error in workVerifier for task ${taskId}; error: ${error.message}, stack: ${error.stack}`);
    }
  }

  private async work(taskId: string, promise: () => Promise<SuccessfulVerifierResponse>): Promise<SuccessfulVerifierResponse> {
    await this.updateTask(taskId, TaskStatus.queued);

    return await this.lock.acquire('task', async done => {
      try {
        await this.updateTask(taskId, TaskStatus.started);

        const result = await promise();

        await this.updateTask(taskId, TaskStatus.finished, result);
        done(undefined, result);
      } catch (error: any) {
        await this.updateTask(taskId, TaskStatus.error, error.response);
        done(error);
      }
    });
  }

  private async updateTask(
    taskIdentifier: string,
    status: TaskStatus,
    result?: SuccessfulVerifierResponse | ErrorVerifierResponse,
  ): Promise<void> {
    await this.workerCallbackService.updateStatus(taskIdentifier, status, result);
  }
}
