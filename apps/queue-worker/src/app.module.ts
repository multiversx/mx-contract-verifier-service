import {
  ApiMetricsController,
  ApiMetricsModule,
  CommonConfigModule,
  HealthCheckController,
  PubSubListenerModule,
} from '@libs/common';
import { ServicesModule } from '@libs/services';
import { LoggingModule } from '@multiversx/sdk-nestjs-common';
import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { BullQueueModule } from './worker/bull.queue.module';
import { VerifierQueueService } from './worker/queues/verifier.queue.service';

@Module({
  imports: [
    LoggingModule,
    ApiMetricsModule,
    AppConfigModule,
    CommonConfigModule,
    BullQueueModule,
    ServicesModule,
    PubSubListenerModule.forRoot({ enableConsumer: true }),
  ],
  providers: [
    VerifierQueueService,
  ],
  controllers: [
    ApiMetricsController,
    HealthCheckController,
  ],
})
export class AppModule { }
