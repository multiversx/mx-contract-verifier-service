import { DynamicModuleUtils } from '@libs/common';
import { DatabaseModule } from '@libs/database';
import { Global, Module } from '@nestjs/common';
import { ExampleService } from './example/example.service';
import { PinataService } from './pinata';
import { TaskService } from './task';
import { TokenService } from './token/token.service';
import { UserService } from './user/user.service';
import { VerifierService } from './verifier';

@Global()
@Module({
  imports: [
    DatabaseModule,
    DynamicModuleUtils.getCachingModule(),
  ],
  providers: [
    TokenService,
    UserService,
    ExampleService,
    VerifierService,
    TaskService,
    PinataService,
  ],
  exports: [
    TokenService,
    UserService,
    ExampleService,
    VerifierService,
    TaskService,
    PinataService,
  ],
})
export class ServicesModule { }
