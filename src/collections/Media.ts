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
    group: '内容',
    useAsTitle: 'filename',
  },
  upload: {
    // 媒体文件实际存放在持久化挂载卷 /app/public/media（compose 挂载 ./public/media:/app/public/media）。
    // 必须指向 public/media，否则容器重建后 /app/media 软链丢失会导致 /api/media/file/* 全部 500。
    staticDir: 'public/media',
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
