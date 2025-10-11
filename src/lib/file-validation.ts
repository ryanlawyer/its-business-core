import { fileTypeFromBuffer } from 'file-type';
import path from 'path';

/**
 * Allowed image MIME types for receipt upload
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
] as const;

/**
 * Allowed file extensions
 */
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.pdf'] as const;

/**
 * Default max file size (10MB in bytes)
 */
export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Validate file size against system settings
 */
export function validateFileSize(fileSize: number, maxSizeMB: number = 10): {
  valid: boolean;
  error?: string;
} {
  const maxBytes = maxSizeMB * 1024 * 1024;

  if (fileSize > maxBytes) {
    return {
      valid: false,
      error: `File size (${(fileSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Validate file type by checking magic bytes (not just extension)
 * This prevents malicious files with fake extensions
 */
export async function validateFileType(buffer: Buffer): Promise<{
  valid: boolean;
  mimeType?: string;
  error?: string;
}> {
  try {
    // Check magic bytes using file-type library
    const detectedType = await fileTypeFromBuffer(buffer);

    if (!detectedType) {
      return {
        valid: false,
        error: 'Unable to detect file type. File may be corrupted or invalid.',
      };
    }

    // Check if detected type is in our allowed list
    if (!ALLOWED_IMAGE_TYPES.includes(detectedType.mime as any) && detectedType.mime !== 'application/pdf') {
      return {
        valid: false,
        error: `File type ${detectedType.mime} is not allowed. Only JPEG, PNG, HEIC, and PDF files are accepted.`,
      };
    }

    return {
      valid: true,
      mimeType: detectedType.mime,
    };
  } catch (error) {
    console.error('Error validating file type:', error);
    return {
      valid: false,
      error: 'Failed to validate file type',
    };
  }
}

/**
 * Sanitize filename to prevent directory traversal and other attacks
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes
  let clean = filename.replace(/[\/\\:\0]/g, '_');

  // Remove leading dots (hidden files)
  clean = clean.replace(/^\.+/, '');

  // Replace multiple spaces with single space
  clean = clean.replace(/\s+/g, ' ');

  // Remove any non-alphanumeric characters except: space, dash, underscore, dot
  clean = clean.replace(/[^a-zA-Z0-9\s\-_\.]/g, '');

  // Limit length to 200 characters
  if (clean.length > 200) {
    const ext = path.extname(clean);
    const name = path.basename(clean, ext);
    clean = name.substring(0, 200 - ext.length) + ext;
  }

  // Ensure we still have a filename after sanitization
  if (!clean || clean === '') {
    clean = 'receipt';
  }

  return clean;
}

/**
 * Generate unique filename with timestamp to prevent collisions
 */
export function generateUniqueFilename(originalFilename: string, poNumber: string): string {
  const sanitized = sanitizeFilename(originalFilename);
  const ext = path.extname(sanitized);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);

  // Format: PO-2025-001_1234567890_abc123.pdf
  return `${poNumber}_${timestamp}_${random}${ext}`;
}

/**
 * Validate file extension
 */
export function validateFileExtension(filename: string): {
  valid: boolean;
  error?: string;
} {
  const ext = path.extname(filename).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext as any)) {
    return {
      valid: false,
      error: `File extension ${ext} is not allowed. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Check if file is an image (vs PDF)
 */
export function isImageFile(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(mimeType as any);
}

/**
 * Check if file is a PDF
 */
export function isPdfFile(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

/**
 * Complete file validation
 */
export async function validateUploadedFile(
  buffer: Buffer,
  filename: string,
  maxSizeMB: number = 10
): Promise<{
  valid: boolean;
  mimeType?: string;
  sanitizedFilename?: string;
  errors: string[];
}> {
  const errors: string[] = [];

  // Validate file size
  const sizeValidation = validateFileSize(buffer.length, maxSizeMB);
  if (!sizeValidation.valid) {
    errors.push(sizeValidation.error!);
  }

  // Validate file extension
  const extValidation = validateFileExtension(filename);
  if (!extValidation.valid) {
    errors.push(extValidation.error!);
  }

  // Validate file type by magic bytes
  const typeValidation = await validateFileType(buffer);
  if (!typeValidation.valid) {
    errors.push(typeValidation.error!);
  }

  // Sanitize filename
  const sanitizedFilename = sanitizeFilename(filename);

  return {
    valid: errors.length === 0,
    mimeType: typeValidation.mimeType,
    sanitizedFilename,
    errors,
  };
}
