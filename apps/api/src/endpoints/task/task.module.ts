import { ServicesModule } from '@libs/services/services.module';
import { Module } from '@nestjs/common';
import { TaskController } from './task.controller';

@Module({
  imports: [ServicesModule],
  controllers: [TaskController],
})
export class TaskModule {}
