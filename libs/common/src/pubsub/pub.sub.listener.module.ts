import { LoggingModule } from '@multiversx/sdk-nestjs-common';
import { DynamicModule, Module } from '@nestjs/common';
import { AppModule } from 'apps/queue-worker/src/app.module';
import { CommonConfigModule } from '../config';
import { DynamicModuleUtils } from '../utils';
import { PubSubListenerController } from './pub.sub.listener.controller';

@Module({})
export class PubSubListenerModule {
  static forRoot(): DynamicModule {
    return {
      module: PubSubListenerModule,
      imports: [
        LoggingModule,
        CommonConfigModule,
        DynamicModuleUtils.getCachingModule(),
        AppModule,
      ],
      controllers: [
        PubSubListenerController,
      ],
      providers: [
        DynamicModuleUtils.getPubSubService(),
      ],
      exports: ['PUBSUB_SERVICE'],
    };
  }
}
