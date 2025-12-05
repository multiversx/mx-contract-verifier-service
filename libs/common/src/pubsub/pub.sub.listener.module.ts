import { LoggingModule } from '@multiversx/sdk-nestjs-common';
import { DynamicModule, Module } from '@nestjs/common';
import { CommonConfigModule } from '../config';
import { QueueWorkerModule } from '../queue-worker';
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
        QueueWorkerModule
      ],
      controllers: [PubSubListenerController],
      providers: [DynamicModuleUtils.getPubSubService()],
      exports: ['PUBSUB_SERVICE'],
    };
  }
}
