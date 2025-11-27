import { DynamicModuleUtils } from '@libs/common';
import { Module } from '@nestjs/common';
import { TaskModule } from './task/task.module';
import { VerifierModule } from './verifier/verifier.module';

@Module({
  imports: [VerifierModule, TaskModule],
  providers: [DynamicModuleUtils.getNestJsApiConfigService()],
})
export class EndpointsModule {}
