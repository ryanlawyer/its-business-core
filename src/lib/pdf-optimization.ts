import { execFile } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { validatePdf } from '@/lib/image-to-pdf';

const PDF_SIZE_THRESHOLD = 500 * 1024; // 500KB — skip small PDFs
const GS_TIMEOUT_MS = 30_000;

let gsAvailable: boolean | null = null;

/**
 * Check if Ghostscript is available on the system (cached).
 */
export async function isGhostscriptAvailable(): Promise<boolean> {
  if (gsAvailable !== null) return gsAvailable;

  return new Promise((resolve) => {
    execFile('gs', ['--version'], { timeout: 5000 }, (error) => {
      gsAvailable = !error;
      if (gsAvailable) {
        console.log('Ghostscript available for PDF optimization');
      }
      resolve(gsAvailable);
    });
  });
}

export interface PdfOptimizationResult {
  buffer: Buffer;
  optimized: boolean;
  originalSize: number;
  newSize: number;
  method: string;
}

/**
 * Optimize a receipt PDF using Ghostscript image recompression.
 * - Passthrough if <500KB (most digital receipt PDFs)
 * - Uses /ebook preset for good image quality at reduced size
 * - Validates output, ensures it's actually smaller
 * - Graceful fallback on any failure
 */
export async function optimizeReceiptPdf(
  buffer: Buffer,
): Promise<PdfOptimizationResult> {
  const originalSize = buffer.length;

  // Small PDFs: passthrough
  if (originalSize < PDF_SIZE_THRESHOLD) {
    return {
      buffer,
      optimized: false,
      originalSize,
      newSize: originalSize,
      method: 'passthrough (under 500KB)',
    };
  }

  // Check Ghostscript availability
  const gsReady = await isGhostscriptAvailable();
  if (!gsReady) {
    return {
      buffer,
      optimized: false,
      originalSize,
      newSize: originalSize,
      method: 'passthrough (Ghostscript not available)',
    };
  }

  const id = crypto.randomUUID();
  const inputPath = path.join(tmpdir(), `receipt_in_${id}.pdf`);
  const outputPath = path.join(tmpdir(), `receipt_out_${id}.pdf`);

  try {
    await writeFile(inputPath, buffer);

    // Run Ghostscript with /ebook preset
    await new Promise<void>((resolve, reject) => {
      execFile(
        'gs',
        [
          '-sDEVICE=pdfwrite',
          '-dCompatibilityLevel=1.4',
          '-dPDFSETTINGS=/ebook',
          '-dNOPAUSE',
          '-dBATCH',
          '-dQUIET',
          `-sOutputFile=${outputPath}`,
          inputPath,
        ],
        { timeout: GS_TIMEOUT_MS },
        (error) => {
          if (error) reject(error);
          else resolve();
        },
      );
    });

    const optimizedBuffer = Buffer.from(await readFile(outputPath));

    // Validate the output is a valid PDF
    const validation = await validatePdf(optimizedBuffer);
    if (!validation.valid) {
      console.warn('GS output failed PDF validation, using original');
      return {
        buffer,
        optimized: false,
        originalSize,
        newSize: originalSize,
        method: 'passthrough (GS output invalid)',
      };
    }

    // Only use optimized if it's actually smaller
    if (optimizedBuffer.length >= originalSize) {
      return {
        buffer,
        optimized: false,
        originalSize,
        newSize: originalSize,
        method: 'passthrough (GS output not smaller)',
      };
    }

    return {
      buffer: optimizedBuffer,
      optimized: true,
      originalSize,
      newSize: optimizedBuffer.length,
      method: 'ghostscript /ebook',
    };
  } catch (error) {
    console.error('PDF optimization failed, using original:', error);
    return {
      buffer,
      optimized: false,
      originalSize,
      newSize: originalSize,
      method: 'passthrough (GS error)',
    };
  } finally {
    // Clean up temp files
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
