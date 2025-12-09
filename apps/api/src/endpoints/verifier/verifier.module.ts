import { ServicesModule } from '@libs/services/services.module';
import { Module } from '@nestjs/common';
import { VerifierController } from './verifier.controller';

@Module({
  imports: [ServicesModule],
  controllers: [VerifierController],
})
export class VerifierModule {}
