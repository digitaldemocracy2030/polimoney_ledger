'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, FileInput, Group, Image, Stack, Text } from '@mantine/core';
import { IconPhoto, IconUpload } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

interface ImageCropperProps {
  currentImageUrl?: string | null;
  shape: 'circle' | 'square';
  previewSize?: number;
  uploadType: 'politician_photo' | 'party_logo' | 'organization_logo';
  entityId: string;
  onUploadComplete?: (url: string) => void;
  label?: string;
}

interface CropperInstance {
  destroy(): void;
  getCroppedCanvas(options?: {
    width?: number;
    height?: number;
    imageSmoothingEnabled?: boolean;
    imageSmoothingQuality?: 'low' | 'medium' | 'high';
  }): HTMLCanvasElement;
}

interface CropperConstructor {
  new (
    element: HTMLImageElement,
    options?: Record<string, unknown>,
  ): CropperInstance;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window {
    Cropper?: CropperConstructor;
  }
}

export function ImageCropper({
  currentImageUrl,
  shape,
  previewSize = 128,
  uploadType,
  entityId,
  onUploadComplete,
  label,
}: ImageCropperProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [cropperLoaded, setCropperLoaded] = useState(false);
  const router = useRouter();

  const imageRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<CropperInstance | null>(null);

  useEffect(() => {
    if (!document.getElementById('cropper-css')) {
      const link = document.createElement('link');
      link.id = 'cropper-css';
      link.rel = 'stylesheet';
      link.href =
        'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css';
      document.head.appendChild(link);
    }

    if (!window.Cropper) {
      const script = document.createElement('script');
      script.src =
        'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js';
      script.onload = () => setCropperLoaded(true);
      document.head.appendChild(script);
    } else {
      setCropperLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!previewUrl || !imageRef.current || !cropperLoaded || !window.Cropper) {
      return;
    }

    if (cropperRef.current) {
      cropperRef.current.destroy();
    }

    cropperRef.current = new window.Cropper(imageRef.current, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 0.8,
      restore: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
    });

    return () => {
      if (cropperRef.current) {
        cropperRef.current.destroy();
        cropperRef.current = null;
      }
    };
  }, [previewUrl, cropperLoaded]);

  const handleFileChange = (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: '画像ファイルを選択してください' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'ファイルサイズは5MB以下にしてください' });
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setMessage(null);
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleUpload = async () => {
    if (!selectedFile || !cropperRef.current) return;

    setIsUploading(true);
    setMessage(null);

    try {
      const canvas = cropperRef.current.getCroppedCanvas({
        width: 512,
        height: 512,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b: Blob | null) => {
            if (b) resolve(b);
            else reject(new Error('Failed to create blob'));
          },
          'image/png',
          0.9,
        );
      });

      const formData = new FormData();
      formData.append('file', blob, `${uploadType}_${entityId}.png`);
      formData.append('type', uploadType);
      formData.append('entity_id', entityId);

      const response = await fetch('/api/uploads/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'アップロードに失敗しました');
      }

      const result = await response.json();
      setMessage({ type: 'success', text: '画像をアップロードしました' });

      setSelectedFile(null);
      setPreviewUrl(null);

      if (onUploadComplete) {
        onUploadComplete(result.data.url);
      }

      setTimeout(() => router.refresh(), 1000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'アップロードに失敗しました',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    if (cropperRef.current) {
      cropperRef.current.destroy();
      cropperRef.current = null;
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setMessage(null);
  };

  return (
    <Stack gap="md">
      {label && <Text fw={500}>{label}</Text>}

      {message && (
        <Alert color={message.type === 'success' ? 'green' : 'red'}>
          {message.text}
        </Alert>
      )}

      {!previewUrl && (
        <Group gap="md">
          <Box
            style={{
              width: previewSize,
              height: previewSize,
              borderRadius: shape === 'circle' ? '50%' : 'var(--mantine-radius-md)',
              overflow: 'hidden',
              border: '2px solid var(--mantine-color-gray-3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--mantine-color-gray-1)',
            }}
          >
            {currentImageUrl ? (
              <Image
                src={currentImageUrl}
                alt="Current"
                w="100%"
                h="100%"
                fit="cover"
              />
            ) : (
              <IconPhoto size={48} color="var(--mantine-color-gray-4)" />
            )}
          </Box>
          <Stack gap="xs">
            <FileInput
              accept="image/*"
              onChange={handleFileChange}
              placeholder="ファイルを選択"
              leftSection={<IconUpload size={16} />}
              size="sm"
            />
            <Text size="xs" c="dimmed">
              JPEG, PNG, WebP, GIF (最大5MB)
            </Text>
          </Stack>
        </Group>
      )}

      {previewUrl && (
        <Stack gap="md">
          <Box
            style={{
              maxWidth: 448,
              maxHeight: 400,
              margin: '0 auto',
              overflow: 'hidden',
              borderRadius: 'var(--mantine-radius-md)',
              backgroundColor: 'var(--mantine-color-gray-1)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={previewUrl}
              alt="Crop target"
              style={{ display: 'block', maxWidth: '100%' }}
            />
          </Box>

          <Text size="sm" c="dimmed" ta="center">
            ドラッグで位置調整、スクロールでズーム、四隅をドラッグでサイズ変更
          </Text>

          {shape === 'circle' && (
            <style>{`
              .cropper-view-box,
              .cropper-face {
                border-radius: 50%;
              }
            `}</style>
          )}

          <Group justify="center" gap="sm">
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              loading={isUploading}
            >
              アップロード
            </Button>
            <Button
              variant="default"
              onClick={handleCancel}
              disabled={isUploading}
            >
              キャンセル
            </Button>
          </Group>
        </Stack>
      )}
    </Stack>
  );
}
