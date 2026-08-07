import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { generateArticle, generateBatchArticles } from '@/lib/articleGenerator'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { count = 1, triggerType = 'api' } = body
    const siteId = Number(body.siteId)
    const configId = Number(body.configId)

    if (!siteId || !configId || isNaN(siteId) || isNaN(configId)) {
      return NextResponse.json({ error: 'siteId 和 configId 必填（数字）' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    if (count > 1) {
      const result = await generateBatchArticles({
        siteId,
        configId,
        count: Math.min(count, 50),
        payload,
        triggerType,
      })
      return NextResponse.json(result)
    } else {
      const result = await generateArticle({
        siteId,
        configId,
        payload,
        triggerType,
      })
      return NextResponse.json(result)
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '生成失败' }, { status: 500 })
  }
}
