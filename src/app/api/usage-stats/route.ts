import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

export const dynamic = 'force-dynamic'

/**
 * 按天聚合模型调用日志，返回每日调用次数、成功/失败数、成功率。
 * query: ?days=30（默认 30 天）
 * 不返回逐条原始日志，只给汇总，便于后台一眼看清每日趋势。
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = Math.min(Math.max(Number(searchParams.get('days')) || 30, 1), 365)

    const payload = await getPayload({ config: configPromise })

    const since = new Date()
    since.setDate(since.getDate() - days)
    since.setHours(0, 0, 0, 0)

    const { docs } = await payload.find({
      collection: 'model-usage-logs',
      where: {
        createdAt: { greater_than_equal: since.toISOString() },
      },
      limit: 50000,
      depth: 0,
      sort: 'createdAt',
    })

    // 按本地日期聚合
    const byDay: Record<string, { total: number; success: number; failed: number; tokens: number }> = {}
    let total = 0
    let totalSuccess = 0
    let totalTokens = 0
    for (const log of docs as any[]) {
      const d = new Date(log.createdAt)
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!byDay[day]) byDay[day] = { total: 0, success: 0, failed: 0, tokens: 0 }
      byDay[day].total++
      if (log.status === 'success') byDay[day].success++
      else byDay[day].failed++
      if (typeof log.tokens === 'number' && log.tokens > 0) {
        byDay[day].tokens += log.tokens
        totalTokens += log.tokens
      }
      total++
      if (log.status === 'success') totalSuccess++
    }

    // 补齐区间内无调用的日期，保证趋势连续
    const daily: any[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date(since)
      d.setDate(d.getDate() + i)
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const rec = byDay[day] || { total: 0, success: 0, failed: 0, tokens: 0 }
      daily.push({
        date: day,
        total: rec.total,
        success: rec.success,
        failed: rec.failed,
        tokens: rec.tokens,
        successRate: rec.total > 0 ? Number(((rec.success / rec.total) * 100).toFixed(2)) : 100,
      })
    }
    daily.reverse() // 最近日期在前

    const avgSuccessRate = total > 0 ? Number(((totalSuccess / total) * 100).toFixed(2)) : 100

    return NextResponse.json({
      daily,
      summary: {
        total,
        success: totalSuccess,
        failed: total - totalSuccess,
        totalTokens,
        avgSuccessRate,
        days,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || '统计失败' },
      { status: 500 },
    )
  }
}
