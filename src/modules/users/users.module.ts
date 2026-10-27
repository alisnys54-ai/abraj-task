import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { UserTransfersModule } from '../user-transfers/user-transfers.module';
import { MeModule } from '../me/me.module';

@Module({
  imports: [UserTransfersModule, MeModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
