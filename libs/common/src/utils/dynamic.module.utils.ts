import { CacheModule, RedisCacheModuleOptions } from '@multiversx/sdk-nestjs-cache';
import { ERDNEST_CONFIG_SERVICE } from '@multiversx/sdk-nestjs-common';
import { ApiModule, ApiModuleOptions } from '@multiversx/sdk-nestjs-http';
import { DynamicModule, Provider } from '@nestjs/common';
import { ClientOptions, ClientProxyFactory, Transport } from '@nestjs/microservices';
import {
  CommonConfigModule,
  CommonConfigService,
  SdkNestjsConfigServiceImpl,
} from '../config';

export class DynamicModuleUtils {
  static getCachingModule(): DynamicModule {
    return CacheModule.forRootAsync({
      imports: [CommonConfigModule],
      useFactory: (configService: CommonConfigService) =>
        new RedisCacheModuleOptions(
          {
            host: configService.config.redis.host,
            port: configService.config.redis.port,
          },
          {
            poolLimit: 100,
            processTtl: 60,
          },
        ),
      inject: [CommonConfigService],
    });
  }

  static getNestJsApiConfigService(): Provider {
    return {
      provide: ERDNEST_CONFIG_SERVICE,
      useClass: SdkNestjsConfigServiceImpl,
    };
  }

  static getPubSubService(): Provider {
    return {
      provide: 'PUBSUB_SERVICE',
      useFactory: (configService: CommonConfigService) => {
        const clientOptions: ClientOptions = {
          transport: Transport.REDIS,
          options: {
            host: configService.config.redis.host,
            port: configService.config.redis.port,
            retryDelay: 1000,
            retryAttempts: 10,
            retryStrategy: () => 1000,
          },
        };

        return ClientProxyFactory.create(clientOptions);
      },
      inject: [CommonConfigService],
    };
  }

  static getApiModule(): DynamicModule {
    return ApiModule.forRootAsync({
      imports: [CommonConfigModule],
      useFactory: (commonConfigService: CommonConfigService) =>
        new ApiModuleOptions({
          axiosTimeout: 61000,
          rateLimiterSecret: commonConfigService.config.rateLimiterSecret,
          serverTimeout: 60000,
          useKeepAliveAgent: true,
        }),
      inject: [CommonConfigService],
    });
  }
}
