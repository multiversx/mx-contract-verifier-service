import {
  TaskStatus,
  Verifier
} from '@libs/common';
import { VerifierService } from '@libs/services/verifier';
import {
  Inject,
  Injectable,
  Logger
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import AsyncLock from "async-lock";

@Injectable()
export class WorkerService {
  private readonly lock: AsyncLock;
  private readonly logger: Logger;

  constructor(
    @Inject('PUBSUB_SERVICE') private clientProxy: ClientProxy,
    private readonly verifierService: VerifierService,
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

  private updateTask(taskIdentifier: string, status: TaskStatus, result?: any) {
    this.logger.log(`Updating task ${taskIdentifier} with status ${TaskStatus[status]}`);
    this.clientProxy.emit("callback_status", { taskIdentifier, status, result });
  }
}
