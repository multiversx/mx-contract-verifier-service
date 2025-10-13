import { DynamicModuleUtils } from "@libs/common";
import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { ExampleModule } from "./example/example.module";
import { TokenModule } from "./token/token.module";
import { UserModule } from "./user/user.module";
import { VerifierModule } from "./verifier/verifier.module";

@Module({
  imports: [
    AuthModule,
    TokenModule,
    UserModule,
    ExampleModule,
    VerifierModule
  ],
  providers: [
    DynamicModuleUtils.getNestJsApiConfigService(),
  ],
})
export class EndpointsModule { }
