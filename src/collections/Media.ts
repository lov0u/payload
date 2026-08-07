import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  labels: {
    singular: '媒体文件',
    plural: '媒体库',
  },
  admin: {
    useAsTitle: 'filename',
  },
  upload: {
    staticDir: 'media',
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
        height: 300,
        position: 'centre',
      },
      {
        name: 'medium',
        width: 600,
        height: 600,
        position: 'centre',
      },
      {
        name: 'large',
        width: 1200,
        height: 1200,
        position: 'centre',
      },
    ],
    adminThumbnail: 'thumbnail',
    mimeTypes: ['image/*'],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: '图片描述',
    },
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      label: '所属站点',
    },
  ],
}
