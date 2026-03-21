'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, File } from 'lucide-react'

interface FileUploadProps {
  onUploadComplete?: (url: string) => void
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<string | null>(null)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return

      const file = acceptedFiles[0]
      setUploading(true)

      try {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) throw new Error('Upload failed')

        const data = await response.json()
        setUploadedFile(data.url)
        onUploadComplete?.(data.url)
      } catch (error) {
        console.error('Upload error:', error)
        alert('上传失败')
      } finally {
        setUploading(false)
      }
    },
    [onUploadComplete]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov', '.avi'],
      'audio/*': ['.mp3', '.wav'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  })

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-slate-600 hover:border-slate-500'
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="text-slate-400">
            <Upload className="w-12 h-12 mx-auto mb-4 animate-bounce" />
            <p>上传中...</p>
          </div>
        ) : uploadedFile ? (
          <div className="text-green-400">
            <File className="w-12 h-12 mx-auto mb-4" />
            <p>上传成功！</p>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setUploadedFile(null)
              }}
              className="mt-2 text-sm text-slate-400 hover:text-white flex items-center justify-center gap-1"
            >
              <X className="w-4 h-4" />
              清除
            </button>
          </div>
        ) : (
          <div className="text-slate-400">
            <Upload className="w-12 h-12 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">
              {isDragActive ? '放开以上传文件' : '拖拽文件到这里'}
            </p>
            <p className="text-sm">或点击选择文件</p>
            <p className="text-xs text-slate-500 mt-2">
              支持图片、视频、音频 (最大 50MB)
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

