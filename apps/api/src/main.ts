import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Determine which .env file to load based on NODE_ENV
const envPath =
  process.env.NODE_ENV === 'infra' ? '.env' : `.env.${process.env.NODE_ENV ?? 'mainnet'}`;
dotenv.config({
  path: resolve(process.cwd(), envPath),
});

import { LoggerInitializer } from '@multiversx/sdk-nestjs-common';
import {
  LoggingInterceptor,
  MetricsService,
  RequestCpuTimeInterceptor,
} from '@multiversx/sdk-nestjs-monitoring';
import { Logger, NestInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { readFileSync } from 'fs';
import 'module-alias/register';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { join } from 'path';
import { PrivateAppModule } from './private.app.module';
import { PublicAppModule } from './public.app.module';

import '@multiversx/sdk-nestjs-common/lib/utils/extensions/array.extensions';
import '@multiversx/sdk-nestjs-common/lib/utils/extensions/date.extensions';
import '@multiversx/sdk-nestjs-common/lib/utils/extensions/number.extensions';
import '@multiversx/sdk-nestjs-common/lib/utils/extensions/string.extensions';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const publicApp = await NestFactory.create(PublicAppModule);
  publicApp.use(bodyParser.json({ limit: '10mb' }));
  publicApp.enableCors();
  publicApp.useLogger(publicApp.get(WINSTON_MODULE_NEST_PROVIDER));
  publicApp.use(cookieParser());

  const privateApp = await NestFactory.create(PrivateAppModule);

  const appConfigService = publicApp.get<AppConfigService>(AppConfigService);
  const metricsService = privateApp.get<MetricsService>(MetricsService);

  const globalInterceptors: NestInterceptor[] = [];
  globalInterceptors.push(new LoggingInterceptor(metricsService));
  globalInterceptors.push(new RequestCpuTimeInterceptor(metricsService));

  publicApp.useGlobalInterceptors(...globalInterceptors);
  publicApp.useGlobalPipes(new ValidationPipe());

  const description = readFileSync(join(__dirname, '..', 'docs', 'swagger.md'), 'utf8');

  const config = new DocumentBuilder()
    .setTitle('MultiversX Microservice API')
    .setDescription(description)
    .setVersion('1.0.0')
    .setExternalDoc('MultiversX Docs', 'https://docs.multiversx.com')
    .build();

  const document = SwaggerModule.createDocument(publicApp, config);
  SwaggerModule.setup('', publicApp, document);

  await publicApp.listen(appConfigService.config.port);

  await privateApp.listen(appConfigService.config.privatePort);

  const logger = new Logger('Bootstrapper');

  LoggerInitializer.initialize(logger);

  logger.log(`Public API active: ${appConfigService.config.port}`);
  logger.log(`Private API active: ${appConfigService.config.privatePort}`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
