import { Module } from '@nestjs/common';
import { STORAGE_SERVICE } from './storage.interface';
import { LocalDiskStorageService } from './local-disk-storage.service';

@Module({
  providers: [{ provide: STORAGE_SERVICE, useClass: LocalDiskStorageService }],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
