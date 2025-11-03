import { WorkerCallbackService } from "@libs/services/worker";
import { CacheService } from "@multiversx/sdk-nestjs-cache";
import { Controller, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import { WorkerService } from "apps/queue-worker/src/worker/worker.service";
import { TaskStatus } from "../dtos";

@Controller()
export class PubSubListenerController {
  private logger: Logger;

  constructor(
    private readonly cacheService: CacheService,
    private readonly workerService: WorkerService,
    private readonly workerCallbackService: WorkerCallbackService,
  ) {
    this.logger = new Logger(PubSubListenerController.name);
  }

  @EventPattern('deleteCacheKeys')
  async deleteCacheKey(keys: string[]) {
    for (const key of keys) {
      this.logger.log(`Deleting local cache key ${key}`);
      await this.cacheService.deleteLocal(key);
    }
  }

  @EventPattern('validate')
  async validate({
      taskId,
      type,
      value,
      environment,
    }: {
      taskId: string;
      type: string;
      value: any;
      environment: "devnet" | "testnet" | "mainnet";
    }) {
      this.logger.log('Received validate event', { taskId, type, contract: value.validate.payload.contract, environment });
      await this.workerService.addJobIntoQueue(type, taskId, value);
    }

  @EventPattern('callback_status')
  async status(@Payload() payload: { taskIdentifier: string, status: TaskStatus, result?: any; }): Promise<void> {
    await this.workerCallbackService.updateStatus(payload.taskIdentifier, payload.status, payload.result);
  }
}
