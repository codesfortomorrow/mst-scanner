import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as configs from '@Config';
import { validateEnvironmentVariables } from './utils';
import { UtilsService } from './providers';

const providers = [UtilsService];

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: Object.values(configs),
      validate: validateEnvironmentVariables,
    }),
  ],
  providers: providers,
  exports: providers,
})
export class CommonModule {}
