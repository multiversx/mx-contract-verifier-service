import {
  CommonConfigService,
  ContractVerifierStatus,
  Task,
  TaskStatus,
  Verifier,
  VerifierResponse,
} from '@libs/common';
import { CacheService } from '@multiversx/sdk-nestjs-cache';
import { Constants } from '@multiversx/sdk-nestjs-common';
import { ApiService } from '@multiversx/sdk-nestjs-http';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'crypto';

@Injectable()
export class TaskService {
  private MAX_NUMBER_OF_ITERATIONS = 10;
  private POLLING_INTERVAL = 500;
  private readonly logger: Logger;

  constructor(
    private readonly cachingService: CacheService,
    @Inject('PUBSUB_SERVICE') private clientProxy: ClientProxy,
    private readonly configService: CommonConfigService,
    private readonly apiService: ApiService,
  ) {
    this.logger = new Logger(TaskService.name);
  }

  async getTask(id: string): Promise<Task | undefined> {
    return await this.cachingService.getRemote<Task>(`task:${id}`);
  }

  async runVerifier(validate: Verifier): Promise<VerifierResponse> {
    this.logger.log(
      `Received verifier request for contract ${validate.payload.contract}`,
    );
    const { ownerAddress } = await this.apiService.get(
      `${this.configService.config.urls.api}/accounts/${validate.payload.contract}`,
    );
    if (!ownerAddress) {
      return {
        status: ContractVerifierStatus.error,
        message: 'Invalid contract address',
      };
    }
    return await this.run('validate', { validate });
  }

  private async run(type: string, value: any): Promise<any> {
    const taskId = await this.runWork(type, value);

    let iterations = 0;

    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        iterations++;
        const task = await this.cachingService.getRemote<Task>(
          `task:${taskId}`,
        );
        if (task) {
          if (task.status === TaskStatus.finished) {
            clearInterval(interval);
            resolve(task.result);
          } else if (task.status === TaskStatus.error) {
            clearInterval(interval);
            if (task.result instanceof Array) {
              reject(new BadRequestException({ errors: task.result }));
            } else {
              reject(new BadRequestException());
            }
          } else if (iterations >= this.MAX_NUMBER_OF_ITERATIONS) {
            clearInterval(interval);
            reject(new RequestTimeoutException({ taskId }));
          }
        }
      }, this.POLLING_INTERVAL);
    });
  }

  private async runWork(type: string, value: any): Promise<string> {
    const taskId = randomUUID();
    this.clientProxy.emit(this.configService.config.queues.api, {
      taskId,
      type,
      value,
      environment: this.configService.config.network,
    });
    await this.cachingService.setRemote<Task>(
      `task:${taskId}`,
      { status: TaskStatus.queued },
      Constants.oneHour(),
    );
    return taskId;
  }
}
