import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrdersModule } from './orders/orders.module';
import { UsersModule } from './users/users.module';
import { RedisModule } from './redis/redis.module';
import { ScheduledTasksModule } from './scheduled-tasks/scheduled-tasks.module';
import { EmailModule } from './email/email.module';
import { UploadModule } from './upload/upload.module';
import { ThrottlerModule, ThrottlerGuard, seconds } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: seconds(60),
        limit: 30,
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    InventoryModule,
    OrdersModule,
    UsersModule,
    RedisModule,
    ScheduledTasksModule,
    EmailModule,
    UploadModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
