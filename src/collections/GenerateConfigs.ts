import type { CollectionConfig } from 'payload'
import { refreshCronForConfig } from '../cron/generationCron'

export const GenerateConfigs: CollectionConfig = {
  slug: 'generate-configs',
  labels: {
    singular: '生成配置',
    plural: '生成配置管理',
  },
  admin: {
    group: '生成引擎',
    useAsTitle: 'name',
    description: '生成器配置',
    defaultColumns: ['name', 'site', 'enabled', 'dailyCount', 'cronExpression'],
  },
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        // 配置变更后刷新定时任务
        if (req && (req as any).payload) {
          await refreshCronForConfig(doc.id, (req as any).payload)
        }
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: '配置名称',
    },
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      label: '所属站点',
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      label: '启用生成',
    },
    {
      name: 'dailyCount',
      type: 'number',
      defaultValue: 20,
      required: true,
      label: '每日生成数量',
    },
    {
      name: 'cronExpression',
      type: 'text',
      defaultValue: '0 0 2 * * *',
      label: '定时表达式（Cron）',
      admin: {
        description: '默认每天凌晨2点执行，格式：分 时 日 月 周',
      },
    },
    {
      name: 'aiModel',
      type: 'text',
      defaultValue: '@cf/meta/llama-3.1-8b-instruct',
      label: 'AI 模型',
    },
    {
      name: 'articleMinLength',
      type: 'number',
      defaultValue: 1500,
      label: '文章最少字数',
    },
    {
      name: 'articleMaxLength',
      type: 'number',
      defaultValue: 3000,
      label: '文章最多字数',
    },
    {
      name: 'generateImage',
      type: 'checkbox',
      defaultValue: true,
      label: '生成封面图',
    },
    {
      name: 'imageModel',
      type: 'text',
      defaultValue: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
      label: '图片生成模型',
    },
    {
      name: 'autoPublish',
      type: 'checkbox',
      defaultValue: true,
      label: '自动发布',
    },
    {
      name: 'siteName',
      type: 'text',
      label: '站点名称（AI生成用）',
    },
    {
      name: 'siteKeywords',
      type: 'textarea',
      label: '站点核心关键词（每行一个）',
    },
    {
      name: 'customPrompt',
      type: 'textarea',
      label: '自定义 Prompt 模板',
      admin: {
        description: '可用变量：{keyword} {siteName} {minLength} {maxLength}',
      },
    },
  ],
}
