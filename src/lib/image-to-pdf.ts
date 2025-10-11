import { PDFDocument, rgb } from 'pdf-lib';
import sharp from 'sharp';

/**
 * PDF page dimensions (Letter size in points)
 * 1 inch = 72 points
 * Letter size = 8.5" x 11" = 612 x 792 points
 */
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36; // 0.5 inch margin

/**
 * Convert image buffer to PDF
 * Handles JPEG and PNG images
 * Scales image to fit Letter size page with margins
 */
export async function convertImageToPdf(
  imageBuffer: Buffer,
  options: {
    title?: string;
    author?: string;
    subject?: string;
  } = {}
): Promise<Buffer> {
  try {
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to read image dimensions');
    }

    // Convert to grayscale and JPEG format for smaller file size
    const jpegBuffer = await sharp(imageBuffer)
      .grayscale()
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();

    // Set document metadata
    pdfDoc.setTitle(options.title || 'Receipt');
    pdfDoc.setAuthor(options.author || 'ITS Business System');
    pdfDoc.setSubject(options.subject || 'Purchase Order Receipt');
    pdfDoc.setCreator('ITS Business System');
    pdfDoc.setProducer('pdf-lib');
    pdfDoc.setCreationDate(new Date());
    pdfDoc.setModificationDate(new Date());

    // Add a page
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    // Embed the image
    const image = await pdfDoc.embedJpg(jpegBuffer);
    const imageDims = image.scale(1);

    // Calculate dimensions to fit image within page margins
    const maxWidth = PAGE_WIDTH - MARGIN * 2;
    const maxHeight = PAGE_HEIGHT - MARGIN * 2;

    // Calculate scale factor to fit image within bounds
    const widthScale = maxWidth / imageDims.width;
    const heightScale = maxHeight / imageDims.height;
    const scale = Math.min(widthScale, heightScale, 1); // Don't scale up

    const scaledWidth = imageDims.width * scale;
    const scaledHeight = imageDims.height * scale;

    // Center image on page
    const x = (PAGE_WIDTH - scaledWidth) / 2;
    const y = (PAGE_HEIGHT - scaledHeight) / 2;

    // Draw the image
    page.drawImage(image, {
      x,
      y,
      width: scaledWidth,
      height: scaledHeight,
    });

    // Save PDF to buffer
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('Error converting image to PDF:', error);
    throw new Error('Failed to convert image to PDF');
  }
}

/**
 * Create PDF from multiple images
 * Each image gets its own page
 */
export async function createMultiPagePdf(
  imageBuffers: Buffer[],
  options: {
    title?: string;
    author?: string;
    subject?: string;
  } = {}
): Promise<Buffer> {
  try {
    if (imageBuffers.length === 0) {
      throw new Error('No images provided');
    }

    // If only one image, use single-page converter
    if (imageBuffers.length === 1) {
      return convertImageToPdf(imageBuffers[0], options);
    }

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();

    // Set document metadata
    pdfDoc.setTitle(options.title || 'Receipt');
    pdfDoc.setAuthor(options.author || 'ITS Business System');
    pdfDoc.setSubject(options.subject || 'Purchase Order Receipt');
    pdfDoc.setCreator('ITS Business System');
    pdfDoc.setProducer('pdf-lib');
    pdfDoc.setCreationDate(new Date());
    pdfDoc.setModificationDate(new Date());

    // Process each image
    for (const imageBuffer of imageBuffers) {
      // Get image metadata
      const metadata = await sharp(imageBuffer).metadata();
      if (!metadata.width || !metadata.height) {
        console.warn('Skipping image with invalid dimensions');
        continue;
      }

      // Convert to grayscale JPEG for smaller file size
      const jpegBuffer = await sharp(imageBuffer)
        .grayscale()
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();

      // Add a new page
      const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

      // Embed the image
      const image = await pdfDoc.embedJpg(jpegBuffer);
      const imageDims = image.scale(1);

      // Calculate dimensions
      const maxWidth = PAGE_WIDTH - MARGIN * 2;
      const maxHeight = PAGE_HEIGHT - MARGIN * 2;
      const widthScale = maxWidth / imageDims.width;
      const heightScale = maxHeight / imageDims.height;
      const scale = Math.min(widthScale, heightScale, 1);

      const scaledWidth = imageDims.width * scale;
      const scaledHeight = imageDims.height * scale;

      // Center image
      const x = (PAGE_WIDTH - scaledWidth) / 2;
      const y = (PAGE_HEIGHT - scaledHeight) / 2;

      // Draw the image
      page.drawImage(image, {
        x,
        y,
        width: scaledWidth,
        height: scaledHeight,
      });
    }

    // Save PDF to buffer
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('Error creating multi-page PDF:', error);
    throw new Error('Failed to create PDF from images');
  }
}

/**
 * Get PDF metadata
 */
export async function getPdfMetadata(pdfBuffer: Buffer): Promise<{
  pageCount: number;
  title?: string;
  author?: string;
  subject?: string;
  creationDate?: Date;
}> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    return {
      pageCount: pdfDoc.getPageCount(),
      title: pdfDoc.getTitle() || undefined,
      author: pdfDoc.getAuthor() || undefined,
      subject: pdfDoc.getSubject() || undefined,
      creationDate: pdfDoc.getCreationDate() || undefined,
    };
  } catch (error) {
    console.error('Error reading PDF metadata:', error);
    throw new Error('Failed to read PDF metadata');
  }
}

/**
 * Generate PDF thumbnail (first page as JPEG)
 */
export async function generatePdfThumbnail(
  pdfBuffer: Buffer,
  options: {
    width?: number;
    height?: number;
    quality?: number;
  } = {}
): Promise<Buffer> {
  try {
    // For now, we'll return a placeholder
    // Full PDF thumbnail generation requires pdf-to-img or similar
    // This is a simplified version that just returns the PDF as-is
    // In production, you'd use a library like pdf-poppler or pdf2pic

    // For a simple implementation, we can use the first page
    // and indicate it's a PDF with some metadata
    throw new Error('PDF thumbnail generation not yet implemented. Use PDF icon instead.');
  } catch (error) {
    console.error('Error generating PDF thumbnail:', error);
    throw error;
  }
}

/**
 * Validate PDF file
 */
export async function validatePdf(pdfBuffer: Buffer): Promise<{
  valid: boolean;
  error?: string;
  pageCount?: number;
}> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();

    if (pageCount === 0) {
      return {
        valid: false,
        error: 'PDF contains no pages',
      };
    }

    return {
      valid: true,
      pageCount,
    };
  } catch (error) {
    console.error('Error validating PDF:', error);
    return {
      valid: false,
      error: 'Invalid or corrupted PDF file',
    };
  }
}
