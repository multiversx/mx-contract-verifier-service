import { CacheService } from "@multiversx/sdk-nestjs-cache";
import { Controller, Logger } from "@nestjs/common";
import { EventPattern } from "@nestjs/microservices";
import { WorkerService } from "apps/queue-worker/src/worker/worker.service";

@Controller()
export class PubSubListenerController {
  private logger: Logger;

  constructor(
    private readonly cacheService: CacheService,
    private readonly workerService: WorkerService,
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
      await this.workerService.addJobIntoQueue(type, value);
    }
}
