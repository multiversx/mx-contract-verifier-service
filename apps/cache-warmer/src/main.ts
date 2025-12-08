import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Determine which .env file to load based on NODE_ENV
const envPath =
  process.env.NODE_ENV === 'infra' ? '.env' : `.env.${process.env.NODE_ENV ?? 'mainnet'}`;
dotenv.config({
  path: resolve(process.cwd(), envPath),
});

import { NestFactory } from '@nestjs/core';
import 'module-alias/register';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const appConfigService = app.get<AppConfigService>(AppConfigService);

  await app.listen(appConfigService.config.port);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
