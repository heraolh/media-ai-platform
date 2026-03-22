import { createClient } from '@/lib/supabase/server'
import { uploadToR2 } from '@/lib/r2'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
const AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/x-wav']
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg']

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
const AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.aac', '.m4a']
const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.webm', '.mpeg', '.mpg']

function detectAssetType(mimeType: string, filename: string): 'image' | 'audio' | 'video' | null {
  const mime = mimeType.toLowerCase()
  if (IMAGE_TYPES.some(t => mime.startsWith(t.split('/')[0] + '/') ? mime === t : false) || mime.startsWith('image/')) return 'image'
  if (AUDIO_TYPES.some(t => mime === t) || mime.startsWith('audio/')) return 'audio'
  if (VIDEO_TYPES.some(t => mime === t) || mime.startsWith('video/')) return 'video'

  // Fall back to extension
  const ext = ('.' + filename.split('.').pop()).toLowerCase()
  if (IMAGE_EXTS.includes(ext)) return 'image'
  if (AUDIO_EXTS.includes(ext)) return 'audio'
  if (VIDEO_EXTS.includes(ext)) return 'video'
  return null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const assetType = detectAssetType(file.type, file.name)
    const typeDir = assetType ?? 'misc'

    const fileExt = file.name.split('.').pop() ?? 'bin'
    const timestamp = Date.now()
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const key = `uploads/${user.id}/${typeDir}/${timestamp}_${safeFilename}`

    const arrayBuffer = await file.arrayBuffer()
    const url = await uploadToR2(key, arrayBuffer, file.type)

    // Write to user_assets if we detected a known type
    let assetId: string | null = null
    if (assetType) {
      const { data: assetRow, error: insertError } = await supabase
        .from('user_assets')
        .insert({
          user_id: user.id,
          name: file.name,
          type: assetType,
          url,
          r2_key: key,
          size: file.size,
          mime_type: file.type,
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('[upload] Failed to insert user_asset:', insertError)
      } else {
        assetId = assetRow?.id ?? null
      }
    }

    return NextResponse.json({
      url,
      path: key,
      type: assetType,
      id: assetId,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
