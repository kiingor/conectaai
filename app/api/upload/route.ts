import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Bucket público no Supabase Storage (self-hosted). Precisa existir previamente —
// veja sql/2026-05-29_storage_bucket.sql para criá-lo.
const BUCKET = 'uploads'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size based on type (WhatsApp/Evolution limits)
    // Videos: 50MB | Images/Audio: 16MB | Documents: 100MB
    const isVideo = file.type.startsWith('video/')
    const isImageOrAudio = file.type.startsWith('image/') || file.type.startsWith('audio/')
    const maxSize = isVideo ? 50 * 1024 * 1024 : isImageOrAudio ? 16 * 1024 * 1024 : 100 * 1024 * 1024
    if (file.size > maxSize) {
      const maxMB = isVideo ? '50' : isImageOrAudio ? '16' : '100'
      return NextResponse.json({ error: `Arquivo deve ter no maximo ${maxMB}MB` }, { status: 400 })
    }

    // Generate unique path
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const path = `workdesk/${timestamp}-${Math.random().toString(36).substring(2, 9)}.${extension}`

    // Upload to Supabase Storage (self-hosted)
    const supabase = createServiceClient()
    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      console.error('[Upload] Supabase Storage error:', uploadError)
      return NextResponse.json(
        { error: 'Upload failed', details: uploadError.message },
        { status: 500 },
      )
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)

    return NextResponse.json({
      url: pub.publicUrl,
      filename: file.name,
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
