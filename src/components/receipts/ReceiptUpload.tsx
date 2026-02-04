'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UploadedReceipt {
  id: string;
  status: string;
  imageUrl: string;
}

interface QueuedUpload {
  file: File;
  preview: string;
  status: 'queued' | 'uploading' | 'processing' | 'success' | 'error';
  error?: string;
  receipt?: UploadedReceipt;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface ReceiptUploadProps {
  onUploadComplete?: (receipt: UploadedReceipt) => void;
  autoProcess?: boolean;
}

export default function ReceiptUpload({ onUploadComplete, autoProcess = true }: ReceiptUploadProps) {
  const [uploads, setUploads] = useState<QueuedUpload[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  const processReceipt = useCallback(async (receiptId: string, fileForUpdate: File) => {
    try {
      const response = await fetch(`/api/receipts/${receiptId}/process`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Processing failed');
      }

      const data = await response.json();

      // Update status to success with processed data
      setUploads((prev) =>
        prev.map((u) =>
          u.file === fileForUpdate
            ? { ...u, status: 'success' as const, receipt: data.receipt }
            : u
        )
      );

      onUploadComplete?.(data.receipt);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      setUploads((prev) =>
        prev.map((u) =>
          u.file === fileForUpdate
            ? { ...u, status: 'error' as const, error: errorMessage }
            : u
        )
      );
    }
  }, [onUploadComplete]);

  const uploadFile = useCallback(async (file: File) => {
    // Update status to uploading
    setUploads((prev) =>
      prev.map((u) => (u.file === file ? { ...u, status: 'uploading' as const } : u))
    );

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/receipts/upload', {
        method: 'POST',
        body: formData,
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error(`Server error (${response.status})`);
      }

      if (!response.ok) {
        const errorMsg = data.details ? `${data.error}: ${data.details}` : data.error || 'Upload failed';
        throw new Error(errorMsg);
      }

      // If autoProcess is enabled, trigger OCR
      if (autoProcess) {
        setUploads((prev) =>
          prev.map((u) =>
            u.file === file
              ? { ...u, status: 'processing' as const, receipt: data.receipt }
              : u
          )
        );

        // Trigger OCR processing
        await processReceipt(data.receipt.id, file);
      } else {
        // Just mark as success without processing
        setUploads((prev) =>
          prev.map((u) =>
            u.file === file
              ? { ...u, status: 'success' as const, receipt: data.receipt }
              : u
          )
        );
        onUploadComplete?.(data.receipt);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      console.error('Upload error:', errorMessage, error);
      setUploads((prev) =>
        prev.map((u) =>
          u.file === file
            ? { ...u, status: 'error' as const, error: errorMessage }
            : u
        )
      );
    }
  }, [autoProcess, processReceipt, onUploadComplete]);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const validFiles = fileArray.filter((file) => {
        if (!ALLOWED_TYPES.includes(file.type)) {
          alert(`Invalid file type: ${file.name}. Allowed: JPG, PNG, WebP, GIF, PDF`);
          return false;
        }
        if (file.size > MAX_FILE_SIZE) {
          alert(`File too large: ${file.name}. Maximum size is 10MB`);
          return false;
        }
        return true;
      });

      const newUploads: QueuedUpload[] = validFiles.map((file) => {
        const preview = file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : '';
        if (preview) {
          previewUrlsRef.current.add(preview);
        }
        return {
          file,
          preview,
          status: 'uploading' as const,
        };
      });

      setUploads((prev) => [...prev, ...newUploads]);
      validFiles.forEach((file) => uploadFile(file));
    },
    [uploadFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const removeUpload = (file: File) => {
    setUploads((prev) => {
      const upload = prev.find((u) => u.file === file);
      if (upload?.preview) {
        URL.revokeObjectURL(upload.preview);
        previewUrlsRef.current.delete(upload.preview);
      }
      return prev.filter((u) => u.file !== file);
    });
  };

  const retryUpload = (file: File) => {
    setUploads((prev) =>
      prev.map((u) =>
        u.file === file ? { ...u, status: 'uploading' as const, error: undefined } : u
      )
    );
    uploadFile(file);
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    const urlsRef = previewUrlsRef;
    return () => {
      urlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      urlsRef.current.clear();
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />

        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>

        <p className="mt-4 text-sm text-gray-600">
          {isDragging
            ? 'Drop the receipt here...'
            : 'Drag and drop a receipt, or click to select'}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          JPG, PNG, WebP, GIF, or PDF up to 10MB
        </p>
      </div>

      {/* Camera capture button (for mobile) */}
      <div className="flex justify-center">
        <button
          onClick={() => cameraInputRef.current?.click()}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
            />
          </svg>
          Take Photo
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* Upload queue */}
      {uploads.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-900">Uploads</h3>
          {uploads.map((upload, index) => (
            <div
              key={index}
              className="flex items-center space-x-4 bg-white border border-gray-200 rounded-lg p-3"
            >
              {/* Preview */}
              <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-md overflow-hidden">
                {upload.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={upload.preview}
                    alt={upload.file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                      />
                    </svg>
                  </div>
                )}
              </div>

              {/* File info and status */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {upload.file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(upload.file.size / (1024 * 1024)).toFixed(2)} MB
                </p>

                {/* Status indicator */}
                <div className="mt-1">
                  {upload.status === 'queued' && (
                    <span className="inline-flex items-center text-xs text-yellow-600">
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Queued
                    </span>
                  )}
                  {upload.status === 'uploading' && (
                    <span className="inline-flex items-center text-xs text-blue-600">
                      <svg className="w-4 h-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Uploading...
                    </span>
                  )}
                  {upload.status === 'processing' && (
                    <span className="inline-flex items-center text-xs text-purple-600">
                      <svg className="w-4 h-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing with AI...
                    </span>
                  )}
                  {upload.status === 'success' && (
                    <span className="inline-flex items-center text-xs text-green-600">
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Complete
                    </span>
                  )}
                  {upload.status === 'error' && (
                    <span className="inline-flex items-center text-xs text-red-600">
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      {upload.error || 'Failed'}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex-shrink-0 flex space-x-2">
                {upload.status === 'error' && (
                  <button
                    onClick={() => retryUpload(upload.file)}
                    className="text-blue-600 hover:text-blue-800"
                    title="Retry"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => removeUpload(upload.file)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Remove"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
