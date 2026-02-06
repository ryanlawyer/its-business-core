import sharp from 'sharp';

/**
 * XML-escape a string for safe insertion into SVG/XML templates.
 */
function xmlEscape(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * Compression quality settings
 */
const COMPRESSION_QUALITY = 85; // 85% quality (good balance)
const MAX_DIMENSION = 2480; // Max width/height (suitable for Letter size at 300dpi)
const COMPRESSION_THRESHOLD = 2 * 1024 * 1024; // 2MB - compress files larger than this

/**
 * Auto-rotate image based on EXIF orientation data
 * This handles phone photos that are sideways
 */
export async function autoRotateImage(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .toBuffer();
  } catch (error) {
    console.error('Error auto-rotating image:', error);
    throw new Error('Failed to rotate image');
  }
}

/**
 * Compress image if it's larger than threshold
 * Maintains aspect ratio and quality
 */
export async function compressImage(
  buffer: Buffer,
  options: {
    maxSizeMB?: number;
    quality?: number;
    maxDimension?: number;
  } = {}
): Promise<{
  buffer: Buffer;
  compressed: boolean;
  originalSize: number;
  newSize: number;
}> {
  const originalSize = buffer.length;
  const threshold = (options.maxSizeMB || 2) * 1024 * 1024;
  const quality = options.quality || COMPRESSION_QUALITY;
  const maxDim = options.maxDimension || MAX_DIMENSION;

  // If file is already small enough, return as-is
  if (originalSize <= threshold) {
    return {
      buffer,
      compressed: false,
      originalSize,
      newSize: originalSize,
    };
  }

  try {
    // Get image metadata
    const metadata = await sharp(buffer).metadata();

    // Calculate resize dimensions if needed
    let resizeWidth: number | undefined;
    let resizeHeight: number | undefined;

    if (metadata.width && metadata.height) {
      if (metadata.width > maxDim || metadata.height > maxDim) {
        // Calculate dimensions maintaining aspect ratio
        if (metadata.width > metadata.height) {
          resizeWidth = maxDim;
        } else {
          resizeHeight = maxDim;
        }
      }
    }

    // Process image: resize and compress
    let sharpInstance = sharp(buffer);

    if (resizeWidth || resizeHeight) {
      sharpInstance = sharpInstance.resize(resizeWidth, resizeHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert to JPEG with compression
    const compressed = await sharpInstance
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    return {
      buffer: compressed,
      compressed: true,
      originalSize,
      newSize: compressed.length,
    };
  } catch (error) {
    console.error('Error compressing image:', error);
    throw new Error('Failed to compress image');
  }
}

/**
 * Add watermark with timestamp and user info to image
 */
export async function addWatermark(
  buffer: Buffer,
  options: {
    timestamp: Date;
    userName: string;
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  }
): Promise<Buffer> {
  try {
    const { timestamp, userName, position = 'bottom-right' } = options;

    // Get image dimensions
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to read image dimensions');
    }

    // Format timestamp
    const dateStr = timestamp.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const timeStr = timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    // Create watermark text (XML-escaped to prevent SVG injection)
    const watermarkLines = [
      `Uploaded: ${xmlEscape(dateStr)}`,
      `Time: ${xmlEscape(timeStr)}`,
      `By: ${xmlEscape(userName)}`,
    ];

    // Calculate watermark dimensions
    const fontSize = 16;
    const padding = 10;
    const lineHeight = fontSize * 1.5;
    const textWidth = 220;
    const textHeight = watermarkLines.length * lineHeight + padding * 2;

    // Create SVG watermark with semi-transparent background
    const watermarkSvg = `
      <svg width="${textWidth}" height="${textHeight}">
        <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.7)" rx="5"/>
        ${watermarkLines
          .map(
            (line, i) => `
          <text
            x="${padding}"
            y="${padding + (i + 1) * lineHeight}"
            font-family="Arial, sans-serif"
            font-size="${fontSize}"
            fill="white"
          >${line}</text>
        `
          )
          .join('')}
      </svg>
    `;

    // Calculate position based on image size
    let gravity: keyof sharp.Gravity;
    switch (position) {
      case 'bottom-right':
        gravity = 'southeast';
        break;
      case 'bottom-left':
        gravity = 'southwest';
        break;
      case 'top-right':
        gravity = 'northeast';
        break;
      case 'top-left':
        gravity = 'northwest';
        break;
      default:
        gravity = 'southeast';
    }

    // Apply watermark to image
    const watermarked = await sharp(buffer)
      .composite([
        {
          input: Buffer.from(watermarkSvg),
          gravity,
          blend: 'over',
        },
      ])
      .toBuffer();

    return watermarked;
  } catch (error) {
    console.error('Error adding watermark:', error);
    throw new Error('Failed to add watermark to image');
  }
}

/**
 * Complete image processing pipeline:
 * 1. Auto-rotate based on EXIF
 * 2. Add watermark
 * 3. Compress if needed
 */
export async function processImage(
  buffer: Buffer,
  options: {
    timestamp: Date;
    userName: string;
    compress?: boolean;
    maxSizeMB?: number;
  }
): Promise<{
  buffer: Buffer;
  processed: boolean;
  originalSize: number;
  newSize: number;
  steps: string[];
}> {
  const steps: string[] = [];
  let processedBuffer = buffer;
  const originalSize = buffer.length;

  try {
    // Step 1: Auto-rotate
    processedBuffer = await autoRotateImage(processedBuffer);
    steps.push('auto-rotated');

    // Step 2: Add watermark
    processedBuffer = await addWatermark(processedBuffer, {
      timestamp: options.timestamp,
      userName: options.userName,
      position: 'bottom-right',
    });
    steps.push('watermarked');

    // Step 3: Compress if enabled or file is too large
    if (options.compress !== false) {
      const compressed = await compressImage(processedBuffer, {
        maxSizeMB: options.maxSizeMB || 2,
        quality: COMPRESSION_QUALITY,
      });
      if (compressed.compressed) {
        processedBuffer = compressed.buffer;
        steps.push(`compressed (${(compressed.originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressed.newSize / 1024 / 1024).toFixed(2)}MB)`);
      }
    }

    return {
      buffer: processedBuffer,
      processed: true,
      originalSize,
      newSize: processedBuffer.length,
      steps,
    };
  } catch (error) {
    console.error('Error in image processing pipeline:', error);
    throw new Error('Failed to process image');
  }
}

/**
 * Convert HEIC/HEIF images to JPEG
 * Note: sharp handles HEIC natively if libheif is installed
 */
export async function convertHeicToJpeg(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer).jpeg({ quality: 95 }).toBuffer();
  } catch (error) {
    console.error('Error converting HEIC to JPEG:', error);
    throw new Error('Failed to convert HEIC image. This format may not be supported on your system.');
  }
}

/**
 * Get image metadata
 */
export async function getImageMetadata(buffer: Buffer): Promise<sharp.Metadata> {
  try {
    return await sharp(buffer).metadata();
  } catch (error) {
    console.error('Error reading image metadata:', error);
    throw new Error('Failed to read image metadata');
  }
}
