
process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET || 'payload-prod-secret-2024-ra0'
process.env.DATABASE_URI = process.env.DATABASE_URI || 'postgres://payload:payloadpass123@postgres:5432/payload'

const sites = [
  {
    name: '爱回收再生资源',
    slug: 'lov0u',
    domain: 'lov0u.cn',
    industry: '废品回收 / 再生资源',
    description: '废铜、废铝、废铁、不锈钢、电缆、塑料、电子设备等再生资源回收资讯站。',
    keywords: ['废品回收', '废铜回收', '废铝回收', '废铁回收', '电缆回收', '不锈钢回收', '再生资源', '电子废料回收'],
  },
  {
    name: '玉石头',
    slug: 'yushitou',
    domain: 'yushitou.cn',
    industry: '玉石 / 珠宝知识',
    description: '玉石鉴别、翡翠和田玉知识、珠宝保养、玉石文化与选购指南。',
    keywords: ['玉石鉴别', '翡翠知识', '和田玉', '玉石保养', '玉石价格', '翡翠选购', '玉器收藏', '珠宝知识'],
  },
  {
    name: '赛途车行',
    slug: 'saituqimao',
    domain: 'saituqimao.cn',
    industry: '汽车销售 / 二手车',
    description: '烟台汽车销售、新车、二手车、SUV、轿车、MPV、新能源车选购与用车资讯。',
    keywords: ['烟台汽车销售', '二手车', '新车', 'SUV', '轿车', 'MPV', '新能源车', '车辆检测', '汽车交易'],
  },
  {
    name: 'Z新浪资讯',
    slug: 'zsina',
    domain: 'zsina.cn',
    industry: '综合资讯 / 生活百科',
    description: '生活资讯、热点解读、实用百科、消费指南与日常知识内容站。',
    keywords: ['生活百科', '热点资讯', '实用知识', '消费指南', '健康生活', '科技资讯', '家居生活', '职场经验'],
  },
  {
    name: '糖豆宠物',
    slug: 'tandou518',
    domain: 'tandou518.cn',
    industry: '宠物 / 养宠知识',
    description: '猫狗等宠物品种、喂养、护理、训练、健康与养宠经验内容站。',
    keywords: ['宠物饲养', '猫咪护理', '狗狗训练', '宠物健康', '宠物品种', '养猫知识', '养狗知识', '宠物用品'],
  },
  {
    name: 'XSC888资讯',
    slug: 'xsc888',
    domain: 'xsc888.cn',
    industry: '综合资讯 / 实用指南',
    description: '实用指南、生活常识、行业资讯、问题解答与经验分享内容站。',
    keywords: ['实用指南', '生活常识', '经验分享', '行业资讯', '问题解答', '知识科普', '生活技巧', '热门话题'],
  },
]

const cronList = [
  '0 0 2 * * *',
  '0 10 2 * * *',
  '0 20 2 * * *',
  '0 30 2 * * *',
  '0 40 2 * * *',
  '0 50 2 * * *',
]

async function findOne(payload, collection, where) {
  const res = await payload.find({ collection, where, limit: 1, depth: 0 })
  return res.docs[0]
}

async function main() {
  const { getPayload } = await import('payload')
  const config = (await import('./src/payload.config.ts')).default
  const payload = await getPayload({ config })
  let createdSites = 0
  let createdCategories = 0
  let createdConfigs = 0
  let createdKeywords = 0

  for (let i = 0; i < sites.length; i++) {
    const s = sites[i]
    let site = await findOne(payload, 'sites', { slug: { equals: s.slug } })
    if (!site) {
      site = await payload.create({
        collection: 'sites',
        data: {
          name: s.name,
          slug: s.slug,
          domain: s.domain,
          industry: s.industry,
          description: s.description,
          enabled: true,
        },
      })
      createdSites++
    }

    const categorySlug = `${s.slug}-default`
    const category = await findOne(payload, 'categories', { slug: { equals: categorySlug } })
    if (!category) {
      await payload.create({
        collection: 'categories',
        data: {
          name: '默认分类',
          slug: categorySlug,
          site: site.id,
          description: `${s.name}默认文章分类`,
        },
      })
      createdCategories++
    }

    const configName = `${s.name} - 每日生成20篇`
    const genConfig = await findOne(payload, 'generate-configs', {
      and: [{ site: { equals: site.id } }, { name: { equals: configName } }],
    })
    if (!genConfig) {
      await payload.create({
        collection: 'generate-configs',
        data: {
          name: configName,
          site: site.id,
          enabled: true,
          dailyCount: 20,
          cronExpression: cronList[i],
          aiModel: '@cf/meta/llama-3.1-8b-instruct',
          articleMinLength: 1500,
          articleMaxLength: 3000,
          generateImage: true,
          imageModel: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
          autoPublish: true,
          siteName: s.name,
          siteKeywords: s.keywords.join('\n'),
          customPrompt: `请围绕关键词"{keyword}"，为"{siteName}"写一篇中文 SEO 文章。要求标题自然，内容原创，结构清晰，包含小标题，字数在 {minLength}-{maxLength} 字之间，不要堆砌关键词。`,
        },
      })
      createdConfigs++
    }

    for (const kw of s.keywords) {
      const existing = await findOne(payload, 'generate-keywords', {
        and: [{ site: { equals: site.id } }, { keyword: { equals: kw } }],
      })
      if (!existing) {
        await payload.create({
          collection: 'generate-keywords',
          data: {
            keyword: kw,
            keywordType: 'seed',
            status: 'pending',
            sourceType: 'manual',
            site: site.id,
          },
        })
        createdKeywords++
      }
    }
  }

  console.log(JSON.stringify({ createdSites, createdCategories, createdConfigs, createdKeywords }, null, 2))
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err)
  process.exit(1)
})
