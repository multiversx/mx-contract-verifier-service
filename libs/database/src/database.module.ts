import { CommonConfigModule, CommonConfigService } from '@libs/common';
import {
  ContractVerifier,
  ContractVerifierSchema,
} from '@libs/entities';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContractVerifierRepository } from './repositories/contract.verifier.repository';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [CommonConfigModule],
      useFactory: (configService: CommonConfigService) => ({
        uri: `mongodb://${configService.config.database.host}:${configService.config.database.port}`,
        dbName: configService.config.database.name,
        user: configService.config.database.username,
        pass: configService.config.database.password,
        tlsAllowInvalidCertificates:
          configService.config.database.tlsAllowInvalidCertificates,
      }),
      inject: [CommonConfigService],
    }),
    MongooseModule.forFeature([
      { name: ContractVerifier.name, schema: ContractVerifierSchema },
    ]),
  ],
  providers: [ContractVerifierRepository],
  exports: [ContractVerifierRepository],
})

export class DatabaseModule {}
