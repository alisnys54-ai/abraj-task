import { Module } from '@nestjs/common';
import { FileHubController } from './file-hub.controller';
import { FileHubService } from './file-hub.service';
import { FileHubRepository } from './file-hub.repository';

@Module({
  controllers: [FileHubController],
  providers: [FileHubService, FileHubRepository],
})
export class FileHubModule {}
