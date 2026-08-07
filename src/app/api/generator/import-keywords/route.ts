import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { keywords, keywordType = 'seed', sourceType = 'manual' } = body
    const siteId = Number(body.siteId)

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'keywords 数组必填' }, { status: 400 })
    }

    if (!siteId || isNaN(siteId)) {
      return NextResponse.json({ error: 'siteId 必填（数字）' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    let successCount = 0
    let skipCount = 0
    const errors: string[] = []

    for (const keyword of keywords) {
      const trimmed = String(keyword).trim()
      if (!trimmed) {
        skipCount++
        continue
      }

      try {
        const existing = await payload.find({
          collection: 'generate-keywords',
          where: {
            keyword: { equals: trimmed },
            site: { equals: siteId },
          },
          limit: 1,
        })

        if (existing.totalDocs > 0) {
          skipCount++
          continue
        }

        await payload.create({
          collection: 'generate-keywords',
          data: {
            keyword: trimmed,
            keywordType,
            status: 'pending',
            sourceType,
            site: siteId,
          },
        })
        successCount++
      } catch (e: any) {
        errors.push(`${trimmed}: ${e.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      successCount,
      skipCount,
      errorCount: errors.length,
      errors: errors.slice(0, 10),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '导入失败' }, { status: 500 })
  }
}
