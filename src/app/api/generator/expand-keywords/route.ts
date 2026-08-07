import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { chatCompletion, type ChatMessage } from '@/lib/openaiClient'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { seedKeyword, siteId, count = 10 } = body

    if (!seedKeyword || !siteId) {
      return NextResponse.json({ error: 'seedKeyword 和 siteId 必填' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    const site = await payload.findByID({
      collection: 'sites',
      id: siteId,
    })

    if (!site) {
      return NextResponse.json({ error: '站点不存在' }, { status: 404 })
    }

    const { docs: configs } = await payload.find({
      collection: 'generate-configs',
      where: { site: { equals: siteId } },
      limit: 1,
    })
    const siteKeywords = (configs[0]?.siteKeywords as string)?.split('\n').filter(Boolean) || []

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一位SEO关键词专家，擅长挖掘长尾关键词。
要求：
1. 每个长尾关键词要包含核心关键词"${seedKeyword}"或其变体
2. 关键词要符合用户搜索习惯，有真实搜索量
3. 关键词之间要有差异化，覆盖不同搜索意图
4. 关键词长度在 4-15 个字之间
5. 只输出关键词，每行一个，不要编号，不要任何其他说明`,
      },
      {
        role: 'user',
        content: `行业：${site.industry || '综合'}
站点：${site.name}
站点关键词：${siteKeywords.join('、')}
核心关键词：${seedKeyword}

请生成 ${count} 个围绕"${seedKeyword}"的长尾关键词。`,
      },
    ]

    const result = await chatCompletion(payload, messages, {
      temperature: 0.8,
      maxTokens: 1000,
      purpose: 'generate_title',
      siteId,
    })

    const keywords = result.content
      .split('\n')
      .map(line => line.replace(/^\d+[\.、\)\s]+/, '').trim())
      .filter(line => line.length >= 2 && line.length <= 30)
      .slice(0, count)

    const imported = []
    for (const keyword of keywords) {
      try {
        const existing = await payload.find({
          collection: 'generate-keywords',
          where: {
            keyword: { equals: keyword },
            site: { equals: siteId },
          },
          limit: 1,
        })

        if (existing.totalDocs > 0) continue

        const doc = await payload.create({
          collection: 'generate-keywords',
          data: {
            keyword,
            keywordType: 'longtail',
            status: 'pending',
            sourceType: 'ai_expanded',
            site: siteId,
          },
        })
        imported.push(doc)
      } catch (e) {
        // 重复的跳过
      }
    }

    return NextResponse.json({
      success: true,
      generated: keywords,
      imported: imported.length,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '扩词失败' }, { status: 500 })
  }
}
