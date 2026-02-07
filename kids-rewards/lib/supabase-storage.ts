/**
 * Supabase Storage Integration for Images
 *
 * Uses existing Supabase credentials - no additional setup needed!
 */

import { supabaseAdmin } from './supabase';
import { randomUUID } from 'crypto';

const BUCKET_NAME = 'submission-images';

export interface UploadResult {
  path: string;
  publicUrl: string;
}

/**
 * Upload an image buffer to Supabase Storage
 */
export async function uploadImage(
  buffer: Buffer,
  mimeType: string,
  metadata?: {
    kid_id?: string;
    kid_name?: string;
    telegram_file_id?: string;
  }
): Promise<UploadResult> {
  const fileExtension = mimeType.split('/')[1] || 'jpg';
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `${randomUUID()}.${fileExtension}`;
  const path = `${date}/${filename}`;

  // Upload to Supabase Storage
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(path, buffer, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return {
    path: data.path,
    publicUrl
  };
}

/**
 * Get public URL for an existing image
 */
export function getPublicUrl(path: string): string {
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return publicUrl;
}

/**
 * Delete an image from storage
 */
export async function deleteImage(path: string): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }
}

/**
 * Check if storage bucket exists (for setup verification)
 */
export async function checkBucketExists(): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.storage.getBucket(BUCKET_NAME);
    return !error && !!data;
  } catch {
    return false;
  }
}
