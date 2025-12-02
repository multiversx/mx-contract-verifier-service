import { LoggingModule } from '@multiversx/sdk-nestjs-common';
import { DynamicModule, Module } from '@nestjs/common';
import { CommonConfigModule } from '../config';
import { QueueWorkerModule } from '../queue-worker';
import { DynamicModuleUtils } from '../utils';
import { PubSubListenerController } from './pub.sub.listener.controller';

export interface PubSubListenerModuleOptions {
  enableConsumer?: boolean;
}

@Module({})
export class PubSubListenerModule {
  static forRoot(options: PubSubListenerModuleOptions = {}): DynamicModule {
    // Only register controller if enableConsumer is true
    const controllers = options.enableConsumer ? [PubSubListenerController] : [];

    return {
      module: PubSubListenerModule,
      imports: [
        LoggingModule,
        CommonConfigModule,
        DynamicModuleUtils.getCachingModule(),
        QueueWorkerModule,
      ],
      controllers,
      providers: [DynamicModuleUtils.getPubSubService()],
      exports: ['PUBSUB_SERVICE'],
    };
  }
}
