import { ApiMetricsController, ApiMetricsModule, CommonConfigModule, HealthCheckController } from '@libs/common';
import { ServicesModule } from '@libs/services';
import { LoggingModule } from '@multiversx/sdk-nestjs-common';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { BullQueueModule } from './worker/bull.queue.module';
import { VerifierQueueService } from './worker/queues/verifier.queue.service';
import { WorkerService } from './worker/worker.service';

@Module({
  imports: [
    LoggingModule,
    ApiMetricsModule,
    AppConfigModule,
    CommonConfigModule,
    BullQueueModule,
    ServicesModule,
    BullModule.registerQueue({
      name: 'verifierQueue',
    }),
  ],
  providers: [
    WorkerService,
    VerifierQueueService,
  ],
  controllers: [
    ApiMetricsController,
    HealthCheckController,
  ],
  exports: [WorkerService],
})
export class AppModule { }
