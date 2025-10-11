'use client';

import { useState, useRef } from 'react';

interface ReceiptUploaderProps {
  poId: string;
  poNumber: string;
  existingReceipt?: {
    filename: string;
    filepath: string;
  } | null;
  onUploadSuccess: () => void;
  onUploadError: (error: string) => void;
  canUpload: boolean;
}

export default function ReceiptUploader({
  poId,
  poNumber,
  existingReceipt,
  onUploadSuccess,
  onUploadError,
  canUpload,
}: ReceiptUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file size (10MB default, but will be checked by server too)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      onUploadError(
        `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of 10MB`
      );
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      onUploadError(
        'Invalid file type. Only JPEG, PNG, HEIC, and PDF files are supported.'
      );
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', file);

      // Simulate progress (since fetch doesn't support upload progress easily)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch(`/api/purchase-orders/${poId}/upload-receipt`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const result = await response.json();
      console.log('Upload successful:', result);

      // Reset file inputs
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';

      onUploadSuccess();
    } catch (error: any) {
      console.error('Upload error:', error);
      onUploadError(error.message || 'Failed to upload receipt');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleGalleryClick = () => {
    fileInputRef.current?.click();
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this receipt? This will permanently remove the file and allow you to upload a new one.')) return;

    try {
      const response = await fetch(`/api/purchase-orders/${poId}/upload-receipt`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete receipt');
      }

      const result = await response.json();
      console.log('Delete successful:', result);

      // Trigger success callback to refresh the PO data
      onUploadSuccess();
    } catch (error: any) {
      console.error('Delete error:', error);
      onUploadError(error.message || 'Failed to delete receipt');
    }
  };

  if (!canUpload) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-600">
          You do not have permission to upload receipts
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload Buttons */}
      {!existingReceipt && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Receipt
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Gallery Button */}
            <button
              type="button"
              onClick={handleGalleryClick}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className="w-6 h-6 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-sm font-medium text-gray-700">
                Choose from Gallery
              </span>
            </button>

            {/* Camera Button */}
            <button
              type="button"
              onClick={handleCameraClick}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className="w-6 h-6 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-sm font-medium text-gray-700">
                Take Photo
              </span>
            </button>
          </div>

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
            className="hidden"
          />

          <p className="mt-2 text-xs text-gray-500">
            Supported formats: JPEG, PNG, HEIC, PDF (max 10MB)
          </p>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">
              Uploading receipt...
            </span>
            <span className="text-sm text-blue-700">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-blue-700">
            Processing image and converting to PDF...
          </p>
        </div>
      )}

      {/* Existing Receipt Display */}
      {existingReceipt && !uploading && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <svg
                className="w-10 h-10 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-green-900">
                  Receipt Uploaded
                </p>
                <p className="text-xs text-green-700">{existingReceipt.filename}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={`/api/purchase-orders/${poId}/receipt?t=${Date.now()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View
              </a>
              <a
                href={`/api/purchase-orders/${poId}/receipt?download=true&t=${Date.now()}`}
                download
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Download
              </a>
              <button
                type="button"
                onClick={handleDelete}
                className="text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
