import type { CollectionConfig } from 'payload'

export const Sites: CollectionConfig = {
  slug: 'sites',
  access: {
    read: () => true,
  },
  labels: {
    singular: '站点',
    plural: '站点管理',
  },
  admin: {
    group: '系统',
    useAsTitle: 'name',
    description: '站点管理',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: '站点名称',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: '站点标识',
    },
    {
      name: 'domain',
      type: 'text',
      label: '域名',
    },
    {
      name: 'description',
      type: 'textarea',
      label: '站点描述',
    },
    {
      name: 'industry',
      type: 'text',
      label: '行业',
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      label: '启用',
    },
  ],
}
