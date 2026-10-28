export interface UploadUrlResult {
  upload_url: string;
  object_key: string;
}

export interface DownloadUrlResult {
  download_url: string;
  expires_at: Date;
}

/** Every concrete storage backend (MinIO, S3, local disk) implements this — Attachments never depends on a specific provider. */
export interface StorageService {
  getUploadUrl(objectKeyHint: string, mimeType?: string): Promise<UploadUrlResult>;
  getDownloadUrl(objectKey: string): Promise<DownloadUrlResult>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
