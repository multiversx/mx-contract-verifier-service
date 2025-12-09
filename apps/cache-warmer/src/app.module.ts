import {
  ApiMetricsController,
  ApiMetricsModule,
  HealthCheckController,
} from '@libs/common';
import { ServicesModule } from '@libs/services';
import { LoggingModule } from '@multiversx/sdk-nestjs-common';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule } from './config/app-config.module';
import { WarmerService } from './warmer/warmer.service';

@Module({
  imports: [
    LoggingModule,
    ApiMetricsModule,
    ScheduleModule.forRoot(),
    AppConfigModule,
    ServicesModule,
  ],
  providers: [WarmerService],
  controllers: [ApiMetricsController, HealthCheckController],
})
export class AppModule {}
