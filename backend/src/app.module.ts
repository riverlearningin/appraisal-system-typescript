import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CommonModule } from './common/common.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { CyclesController } from './cycles/cycles.controller';
import { SectionsController } from './sections/sections.controller';
import { CyclesService } from './cycles/cycles.service';
import { SectionsService } from './sections/sections.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule, UsersModule, ReviewsModule, CommonModule, PrismaModule
  ],
  controllers: [AppController, CyclesController, SectionsController],
  providers: [AppService, CyclesService, SectionsService],
})
export class AppModule {}
