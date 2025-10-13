import { DynamicModuleUtils } from '@libs/common';
import { DatabaseModule } from '@libs/database';
import { ApiModule } from '@multiversx/sdk-nestjs-http';
import { MetricsModule, MetricsService } from '@multiversx/sdk-nestjs-monitoring';
import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ExampleService } from './example/example.service';
import { PinataService } from './pinata';
import { TaskService } from './task';
import { TokenService } from './token/token.service';
import { UserService } from './user/user.service';
import { VerifierService } from './verifier';

@Global()
@Module({
  imports: [
    MetricsModule,
    ApiModule.forRootAsync({
      imports: [MetricsModule],
      useFactory: (metricsService: MetricsService) => ({
        axiosTimeout: 10000,
        retryAttempts: 3,
        retryDelay: 1000,
        metrics: metricsService,
        useKeepAliveAgent: true,
        serverTimeout: 10000,
        logConnectionKeepAlive: false,
        useKeepAliveHeader: true,
      }),
      inject: [MetricsService],
    }),
    DatabaseModule,
    DynamicModuleUtils.getCachingModule(),
    ClientsModule.register([
      {
        name: 'PUBSUB_SERVICE',
        transport: Transport.REDIS,
        options: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      },
    ]),
  ],
  providers: [
    TokenService,
    UserService,
    ExampleService,
    VerifierService,
    TaskService,
    PinataService,
  ],
  exports: [
    TokenService,
    UserService,
    ExampleService,
    VerifierService,
    TaskService,
    PinataService,
  ],
})
export class ServicesModule { }
