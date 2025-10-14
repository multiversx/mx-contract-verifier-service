import { CacheInfo } from "@libs/common/utils/cache.info";
import { CacheService } from "@multiversx/sdk-nestjs-cache";
import { Locker } from "@multiversx/sdk-nestjs-common";
import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { Cron } from "@nestjs/schedule";

@Injectable()
export class WarmerService {
  constructor(
    private readonly cachingService: CacheService,
    @Inject('PUBSUB_SERVICE') private clientProxy: ClientProxy,
  ) { }

  @Cron('* * * * *')
  async handleExampleInvalidations() {
    await Locker.lock('Example invalidations', async () => {
      const examples = await this.exampleService.getAllExamplesRaw();
      await this.invalidateKey(CacheInfo.Examples.key, examples, CacheInfo.Examples.ttl);
    }, true);
  }

  private async invalidateKey<T>(key: string, data: T, ttl: number) {
    await Promise.all([
      this.cachingService.set(key, data, ttl),
      this.deleteCacheKey(key),
    ]);
  }

  private async deleteCacheKey(key: string) {
    await this.clientProxy.emit('deleteCacheKeys', [key]);
  }
}
