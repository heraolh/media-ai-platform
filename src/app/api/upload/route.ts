import { createClient } from '@/lib/supabase/server'
import { uploadToR2 } from '@/lib/r2'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 验证用户登录
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // 生成唯一文件名
    const fileExt = file.name.split('.').pop()
    const timestamp = Date.now()
    const key = `${user.id}/${timestamp}.${fileExt}`

    // 转换为 ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // 上传到 R2
    const url = await uploadToR2(key, arrayBuffer, file.type)

    return NextResponse.json({
      url,
      path: key,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

