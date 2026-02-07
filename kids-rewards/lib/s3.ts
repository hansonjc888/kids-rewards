/**
 * AWS S3 Integration for Image Storage
 *
 * Handles uploading images to S3 and generating presigned URLs
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.warn('⚠️ AWS credentials not set - image uploads will be disabled');
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  } : undefined
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'kids-rewards-images';

export interface UploadResult {
  key: string;
  bucket: string;
  url: string;
}

/**
 * Upload an image buffer to S3
 */
export async function uploadImage(
  buffer: Buffer,
  mimeType: string,
  metadata?: Record<string, string>
): Promise<UploadResult> {
  const fileExtension = mimeType.split('/')[1] || 'jpg';
  const key = `submissions/${new Date().toISOString().split('T')[0]}/${randomUUID()}.${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    Metadata: metadata
  });

  await s3Client.send(command);

  // Generate a presigned URL that expires in 7 days
  const url = await getPresignedUrl(key, 7 * 24 * 60 * 60);

  return {
    key,
    bucket: BUCKET_NAME,
    url
  };
}

/**
 * Generate a presigned URL for viewing an image
 */
export async function getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });
  return url;
}

/**
 * Check if S3 is configured
 */
export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET
  );
}
