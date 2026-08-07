import type { CollectionConfig } from 'payload'

export const ModelAPIs: CollectionConfig = {
  slug: 'model-apis',
  labels: {
    singular: '模型API',
    plural: '模型API管理',
  },
  admin: {
    useAsTitle: 'name',
    description: '管理多个AI模型API配置，支持故障切换',
    defaultColumns: ['name', 'model', 'apiUrl', 'order', 'enabled', 'totalCalls', 'successRate'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: '配置名称',
      admin: {
        description: '例如：Agnes主模型、Cloudflare备用模型等',
      },
    },
    {
      name: 'apiUrl',
      type: 'text',
      required: true,
      label: 'API地址',
      admin: {
        description: 'OpenAI兼容的API端点，例如：https://apihub.agnes-ai.com/v1',
      },
    },
    {
      name: 'apiKey',
      type: 'text',
      required: true,
      label: 'API密钥',
      admin: {
        description: 'API访问密钥',
      },
    },
    {
      name: 'model',
      type: 'text',
      required: true,
      label: '模型名称',
      admin: {
        description: '例如：agnes-2.5-flash等',
      },
    },
    {
      name: 'order',
      type: 'number',
      required: true,
      defaultValue: 0,
      label: '调用顺序',
      admin: {
        description: '数字越小优先级越高，第一个失败时自动切换到下一个',
      },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      label: '启用',
      admin: {
        description: '禁用后不会参与调用',
      },
    },
    {
      name: 'totalCalls',
      type: 'number',
      defaultValue: 0,
      label: '总调用次数',
      admin: {
        readOnly: true,
        description: '自动统计',
      },
    },
    {
      name: 'successCalls',
      type: 'number',
      defaultValue: 0,
      label: '成功次数',
      admin: {
        readOnly: true,
        description: '自动统计',
      },
    },
    {
      name: 'failedCalls',
      type: 'number',
      defaultValue: 0,
      label: '失败次数',
      admin: {
        readOnly: true,
        description: '自动统计',
      },
    },
    {
      name: 'totalTokens',
      type: 'number',
      defaultValue: 0,
      label: '总Token使用量',
      admin: {
        readOnly: true,
        description: '自动统计',
      },
    },
    {
      name: 'lastUsedAt',
      type: 'date',
      label: '最后使用时间',
      admin: {
        readOnly: true,
        description: '自动统计',
      },
    },
  ],
}
