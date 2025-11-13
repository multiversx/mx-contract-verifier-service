import { VerifierService } from "@libs/services";
import { Locker } from "@multiversx/sdk-nestjs-common";
import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

@Injectable()
export class WarmerService {
  constructor(
    private readonly verifierService: VerifierService,
  ) { }

  @Cron(CronExpression.EVERY_HOUR)
  async handleVerifiedContractsWhereBytecodeChanged() {
    await Locker.lock('remove verified contracts where bytecode changed', async () => {
      await this.verifierService.deleteVerifiedContractsIfByteCodeChanged();
    }, true);
  }
}
