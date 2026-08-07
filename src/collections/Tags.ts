import type { CollectionConfig } from 'payload'

export const Tags: CollectionConfig = {
  slug: 'tags',
  access: {
    read: () => true,
  },
  labels: {
    singular: '标签',
    plural: '文章标签',
  },
  admin: {
    useAsTitle: 'name',
    description: '文章标签',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: '标签名称',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: '标签别名',
    },
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      label: '所属站点',
    },
  ],
}
