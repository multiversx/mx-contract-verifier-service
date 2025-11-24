import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { WorkerService } from './worker.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'verifierQueue',
    }),
  ],
  providers: [WorkerService],
  exports: [WorkerService, BullModule],
})
export class QueueWorkerModule {}
