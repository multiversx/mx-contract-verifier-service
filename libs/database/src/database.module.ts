import { CommonConfigModule, CommonConfigService } from '@libs/common';
import {
  ContractVerifier,
  ContractVerifierSchema,
  Token,
  TokenSchema,
  User,
  UserSchema,
} from '@libs/entities';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserRepository } from './repositories';
import { ContractVerifierRepository } from './repositories/contract.verifier.repository';
import { TokenRepository } from './repositories/token.repository';

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
      { name: Token.name, schema: TokenSchema },
      { name: User.name, schema: UserSchema },
      { name: ContractVerifier.name, schema: ContractVerifierSchema },
    ]),
  ],
  providers: [TokenRepository, UserRepository, ContractVerifierRepository],
  exports: [TokenRepository, UserRepository, ContractVerifierRepository],
})
export class DatabaseModule {}
