import { Cron } from 'croner'
import type { Payload } from 'payload'
import { generateBatchArticles } from '../lib/articleGenerator'

const jobs: Map<string, Cron> = new Map()

export async function initGenerationCron(payload: Payload) {
  console.log('[Cron] 初始化定时生成任务...')

  // 清理现有任务
  for (const [key, job] of jobs) {
    job.stop()
    jobs.delete(key)
  }

  try {
    // 获取所有启用的配置
    const { docs: configs } = await payload.find({
      collection: 'generate-configs',
      where: {
        enabled: { equals: true },
      },
      limit: 100,
    })

    for (const config of configs) {
      const siteId = (config.site as any)?.id || config.site
      const cronExpr = (config.cronExpression as string) || '0 0 2 * * *'
      const dailyCount = (config.dailyCount as number) || 20

      const jobKey = `site-${siteId}-config-${config.id}`

      try {
        const job = new Cron(cronExpr, {
          name: jobKey,
          timezone: 'Asia/Shanghai',
        }, async () => {
          console.log(`[Cron] 触发站点 ${siteId} 生成任务，配置 ${config.id}，数量 ${dailyCount}`)

          try {
            const result = await generateBatchArticles({
              siteId,
              configId: config.id,
              count: dailyCount,
              payload,
              triggerType: 'cron',
            })
            console.log(`[Cron] 站点 ${siteId} 生成完成：成功 ${result.success} 篇，失败 ${result.failed} 篇`)
          } catch (error: any) {
            console.error(`[Cron] 站点 ${siteId} 生成任务失败:`, error.message)
          }
        })

        jobs.set(jobKey, job)
        console.log(`[Cron] 已注册任务: ${jobKey}，表达式: ${cronExpr}`)
      } catch (error: any) {
        console.error(`[Cron] 注册任务失败 ${jobKey}:`, error.message)
      }
    }

  } catch (error: any) {
    console.warn('[Cron] 初始化定时任务失败（可能数据库表未就绪）:', error.message)
  }

  // 注册早上8点的批量发布任务（只注册一次）
  try {
    const publishJob = new Cron('0 0 8 * * *', {
      name: 'publish-drafts',
      timezone: 'Asia/Shanghai',
    }, async () => {
      console.log('[Cron] 触发批量发布草稿任务...')
      try {
        // 获取所有启用的生成配置对应的站点
        const { docs: activeConfigs } = await payload.find({
          collection: 'generate-configs',
          where: { enabled: { equals: true } },
          limit: 100,
        })

        const siteIds = new Set(
          activeConfigs.map((c: any) => (c.site as any)?.id || c.site)
        )

        let publishedCount = 0
        const siteArray = Array.from(siteIds)
        for (let i = 0; i < siteArray.length; i++) {
          const siteId = siteArray[i]
          const { docs: drafts } = await payload.find({
            collection: 'articles',
            where: {
              site: { equals: siteId },
              status: { equals: 'draft' },
            },
            limit: 100,
          })

          for (const draft of drafts) {
            await payload.update({
              collection: 'articles',
              id: draft.id,
              data: {
                status: 'published',
                publishedAt: new Date().toISOString(),
              },
            })
            publishedCount++
          }

          // 每个站点间隔10分钟发布，避免同时发布
          if (i < siteArray.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000))
          }
        }

        console.log(`[Cron] 批量发布完成，共发布 ${publishedCount} 篇草稿`)
      } catch (error: any) {
        console.error('[Cron] 批量发布任务失败:', error.message)
      }
    })

    jobs.set('publish-drafts', publishJob)
    console.log('[Cron] 已注册发布任务: publish-drafts，表达式: 0 0 8 * * *')
  } catch (error: any) {
    console.error('[Cron] 注册发布任务失败:', error.message)
  }

  console.log(`[Cron] 初始化完成，共 ${jobs.size} 个定时任务`)
}

// 刷新某个配置的定时任务（配置变更时调用）
export async function refreshCronForConfig(configId: string | number, payload: Payload) {
  // 找到相关的 job 并停止
  for (const [key, job] of jobs) {
    if (key.includes(`config-${configId}`)) {
      job.stop()
      jobs.delete(key)
    }
  }

  // 重新获取配置并注册
  try {
    const config = await payload.findByID({
      collection: 'generate-configs',
      id: configId,
    })

    if (config && config.enabled) {
      const siteId = (config.site as any)?.id || config.site
      const cronExpr = (config.cronExpression as string) || '0 0 2 * * *'
      const dailyCount = (config.dailyCount as number) || 20
      const jobKey = `site-${siteId}-config-${config.id}`

      const job = new Cron(cronExpr, {
        name: jobKey,
        timezone: 'Asia/Shanghai',
      }, async () => {
        console.log(`[Cron] 触发站点 ${siteId} 生成任务，配置 ${config.id}`)
        try {
          await generateBatchArticles({
            siteId,
            configId: config.id,
            count: dailyCount,
            payload,
            triggerType: 'cron',
          })
        } catch (error: any) {
          console.error(`[Cron] 生成任务失败:`, error.message)
        }
      })

      jobs.set(jobKey, job)
      console.log(`[Cron] 已刷新任务: ${jobKey}`)
    }
  } catch (error: any) {
    console.error(`[Cron] 刷新任务失败:`, error.message)
  }
}

export function getAllCronJobs() {
  return Array.from(jobs.entries()).map(([key, job]) => ({
    name: key,
    nextRun: job.nextRun(),
    isRunning: job.isRunning(),
  }))
}
