import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { CommonModule } from '@Common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma';
import { TokensModule } from './tokens';

@Module({
  imports: [
    CacheModule.register({ isGlobal: true }),
    CommonModule,
    PrismaModule,
    TokensModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
