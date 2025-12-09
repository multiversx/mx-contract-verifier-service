import {
  ApiMetricsController,
  ApiMetricsModule,
  CommonConfigModule,
  HealthCheckController,
} from '@libs/common';
import { PubSubListenerModule } from '@libs/common/pubsub/pub.sub.listener.module';
import { ServicesModule } from '@libs/services';
import { LoggingModule } from '@multiversx/sdk-nestjs-common';
import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { BullQueueModule } from './worker/bull.queue.module';
import { ValidateFromExistingQueueProcessor } from './worker/queues/validate.from.existing.processor';
import { ValidateQueueProcessor } from './worker/queues/validate.queue.processor';

@Module({
  imports: [
    LoggingModule,
    ApiMetricsModule,
    AppConfigModule,
    CommonConfigModule,
    BullQueueModule,
    ServicesModule,
    PubSubListenerModule.forRoot(),
  ],
  providers: [ValidateQueueProcessor, ValidateFromExistingQueueProcessor],
  controllers: [ApiMetricsController, HealthCheckController],
})
export class AppModule {}
