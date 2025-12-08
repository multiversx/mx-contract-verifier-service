import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { QueueWorkerService } from './queue.worker.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'validateQueue',
    }),
    BullModule.registerQueue({
      name: 'validateFromExistingQueue',
    }),
  ],
  providers: [QueueWorkerService],
  exports: [QueueWorkerService],
})
export class QueueWorkerModule {}
