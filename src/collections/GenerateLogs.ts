import type { CollectionConfig } from 'payload'

export const GenerateLogs: CollectionConfig = {
  slug: 'generate-logs',
  labels: {
    singular: '生成日志',
    plural: '生成日志管理',
  },
  admin: {
    group: '生成引擎',
    useAsTitle: 'id',
    description: '生成日志',
    defaultColumns: ['id', 'site', 'status', 'keyword', 'createdAt'],
  },
  fields: [
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      label: '所属站点',
    },
    {
      name: 'config',
      type: 'relationship',
      relationTo: 'generate-configs',
      label: '使用配置',
    },
    {
      name: 'keyword',
      type: 'text',
      label: '使用关键词',
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: '成功', value: 'success' },
        { label: '失败', value: 'failed' },
        { label: '进行中', value: 'running' },
        { label: '跳过', value: 'skipped' },
      ],
      label: '状态',
    },
    {
      name: 'article',
      type: 'relationship',
      relationTo: 'articles',
      label: '生成的文章',
    },
    {
      name: 'errorMessage',
      type: 'textarea',
      label: '错误信息',
    },
    {
      name: 'duration',
      type: 'number',
      label: '耗时（秒）',
    },
    {
      name: 'triggerType',
      type: 'select',
      options: [
        { label: '定时任务', value: 'cron' },
        { label: '手动触发', value: 'manual' },
        { label: 'API 触发', value: 'api' },
      ],
      defaultValue: 'cron',
      label: '触发方式',
    },
  ],
}
