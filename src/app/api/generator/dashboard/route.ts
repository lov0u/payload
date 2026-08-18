import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const payload = await getPayload({ config: configPromise })

    const { docs: sites } = await payload.find({
      collection: 'sites',
      limit: 100,
    })

    const dashboardData = await Promise.all(
      sites.map(async (site) => {
        const [pendingResult, usedResult, disabledResult] = await Promise.all([
          payload.count({
            collection: 'generate-keywords',
            where: { site: { equals: site.id }, status: { equals: 'pending' } },
          }),
          payload.count({
            collection: 'generate-keywords',
            where: { site: { equals: site.id }, status: { equals: 'used' } },
          }),
          payload.count({
            collection: 'generate-keywords',
            where: { site: { equals: site.id }, status: { equals: 'disabled' } },
          }),
        ])

        const articleCount = await payload.count({
          collection: 'articles',
          where: { site: { equals: site.id } },
        })

        // 按北京时间（UTC+8）划定“今日”起点，避免容器 UTC 时区导致每日统计偏移 8 小时
        const bjNow = new Date(Date.now() + 8 * 60 * 60 * 1000)
        bjNow.setHours(0, 0, 0, 0)
        const today = new Date(bjNow.getTime() - 8 * 60 * 60 * 1000)
        const todayGenerated = await payload.count({
          collection: 'generate-logs',
          where: {
            site: { equals: site.id },
            status: { equals: 'success' },
            createdAt: { greater_than_equal: today.toISOString() },
          },
        })

        const { docs: configs } = await payload.find({
          collection: 'generate-configs',
          where: { site: { equals: site.id } },
          limit: 10,
        })

        return {
          site: { id: site.id, name: site.name, slug: site.slug, enabled: site.enabled },
          stats: {
            pendingKeywords: pendingResult.totalDocs,
            usedKeywords: usedResult.totalDocs,
            disabledKeywords: disabledResult.totalDocs,
            totalArticles: articleCount.totalDocs,
            todayGenerated: todayGenerated.totalDocs,
          },
          configs,
        }
      })
    )

    const { docs: modelApis } = await payload.find({
      collection: 'model-apis',
      limit: 100,
      sort: 'order',
    })

    const models = modelApis.map((model) => ({
      id: model.id,
      name: model.name,
      model: model.model,
      order: model.order,
      enabled: model.enabled,
      totalCalls: model.totalCalls || 0,
      successCalls: model.successCalls || 0,
      failedCalls: model.failedCalls || 0,
      successRate: model.totalCalls > 0 ? ((model.successCalls || 0) / model.totalCalls) * 100 : 0,
      totalTokens: model.totalTokens || 0,
      lastUsedAt: model.lastUsedAt || null,
    }))

    const totalModelCalls = models.reduce((s, m) => s + m.totalCalls, 0)

    return NextResponse.json({
      sites: dashboardData,
      models,
      summary: {
        totalSites: sites.length,
        totalPendingKeywords: dashboardData.reduce((s, d) => s + d.stats.pendingKeywords, 0),
        totalArticles: dashboardData.reduce((s, d) => s + d.stats.totalArticles, 0),
        todayGenerated: dashboardData.reduce((s, d) => s + d.stats.todayGenerated, 0),
        totalModels: models.length,
        totalModelCalls,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '获取数据失败' }, { status: 500 })
  }
}
