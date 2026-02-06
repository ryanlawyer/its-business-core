import path from 'path';

const UPLOADS_BASE = path.resolve(process.cwd(), 'uploads');

/**
 * Safely resolve a relative path within the uploads directory.
 * Prevents path traversal attacks.
 */
export function resolveUploadPath(relativePath: string): string | null {
  // Remove any leading slashes or dots
  const cleaned = relativePath.replace(/^[./\\]+/, '');
  const resolved = path.resolve(UPLOADS_BASE, cleaned);

  // Ensure the resolved path is within the uploads directory
  if (!resolved.startsWith(UPLOADS_BASE)) {
    return null;
  }

  return resolved;
}

/**
 * Convert an absolute path to a relative path from the uploads directory.
 */
export function toRelativePath(absolutePath: string): string {
  if (absolutePath.startsWith(UPLOADS_BASE)) {
    return path.relative(UPLOADS_BASE, absolutePath);
  }
  // If it's already relative or doesn't match, return as-is
  return absolutePath;
}

/**
 * Sanitize a filename for use in Content-Disposition headers.
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}
