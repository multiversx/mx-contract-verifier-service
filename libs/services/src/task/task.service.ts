import {
  CommonConfigService,
  Task,
  TaskIdResponse,
  TaskStatus,
  Verifier,
  VerifierFromExisting,
} from '@libs/common';
import { CacheService } from '@multiversx/sdk-nestjs-cache';
import { Constants } from '@multiversx/sdk-nestjs-common';
import { ApiService } from '@multiversx/sdk-nestjs-http';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'crypto';

@Injectable()
export class TaskService {
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

  async runVerifier(validate: Verifier): Promise<TaskIdResponse> {
    this.logger.log(
      `Received verifier request for contract ${validate.payload.contract}`,
    );

    await this.ensureContractExists(validate.payload.contract);
    return await this.run('validate', { validate });
  }

  async runVerifierFromExisting(validateFromExisting: VerifierFromExisting): Promise<TaskIdResponse> {
    this.logger.log(
      `Received verifier request for contract ${validateFromExisting.contract} from existing verified contract ${validateFromExisting.existingVerifiedContract}`,
    );

    await this.ensureContractExists(validateFromExisting.contract);
    await this.ensureContractExists(validateFromExisting.existingVerifiedContract);

    return await this.run('validateFromExisting', { validateFromExisting });
  }

  private async run(type: string, value: any): Promise<TaskIdResponse> {
    const taskId = await this.runWork(type, value);
    return { taskId };
  }

  private async runWork(type: string, value: any): Promise<string> {
    const taskId = randomUUID();
    this.clientProxy.emit(type, {
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

  /** Ensure the contract is deployed by fetching the owner. */
  private async ensureContractExists(address: string): Promise<void> {
    let response: any;
    try {
      response = await this.apiService.get(
        `${this.configService.config.urls.api}/accounts/${address}`,
      );
    } catch (error: any) {
      this.logger.error(`Error fetching account data for contract ${address}, error: ${error.message}`);
      throw new InternalServerErrorException(`Failed to fetch account data for contract ${address}`);
    }

    const ownerAddress = response.data?.ownerAddress;
    if (!ownerAddress) {
      throw new BadRequestException('Could not determine owner address for the contract.');
    }
  }
}
