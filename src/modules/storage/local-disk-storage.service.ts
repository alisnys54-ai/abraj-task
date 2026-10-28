import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { StorageService, UploadUrlResult, DownloadUrlResult } from './storage.interface';

/**
 * Local-disk stand-in behind the same StorageService interface the approved
 * Backend Architecture specifies for MinIO. Swapping in a real MinIO/S3
 * client later is a one-file change (implement StorageService, change the
 * provider binding in storage.module.ts) — nothing in Attachments depends on
 * this implementation directly.
 */
@Injectable()
export class LocalDiskStorageService implements StorageService {
  async getUploadUrl(objectKeyHint: string): Promise<UploadUrlResult> {
    const objectKey = `${randomUUID()}-${objectKeyHint}`;
    return { upload_url: `/local-storage/upload/${objectKey}`, object_key: objectKey };
  }

  async getDownloadUrl(objectKey: string): Promise<DownloadUrlResult> {
    return { download_url: `/local-storage/download/${objectKey}`, expires_at: new Date(Date.now() + 15 * 60 * 1000) };
  }
}
