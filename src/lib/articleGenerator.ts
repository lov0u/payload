import type { Payload } from 'payload'
import { chatCompletion, type ChatMessage } from './openaiClient'
import { pickRandomKeyword, markKeywordUsed, markKeywordReserved, checkKeywordSimilarity } from './keywordPicker'
import { pinyin } from 'pinyin-pro'

export interface GenerateArticleParams {
  siteId: string | number
  configId: string | number
  payload: Payload
  triggerType?: 'cron' | 'manual' | 'api'
}

export interface GenerateResult {
  success: boolean
  articleId?: string | number
  keyword?: string
  title?: string
  error?: string
  duration?: number
}

/**
 * 正则转义：避免关键词包含 . * ? ( ) 等特殊字符时正则报错或误匹配
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 计算关键词密度（中文正确算法）
 *   密度 = (关键词出现次数 × 关键词字数) / 全文纯文字总字数 × 100%
 * 旧实现漏乘「关键词字数」，导致密度被严重低估、AI 过度堆砌。
 * 这里对关键词做正则转义，避免特殊字符破坏匹配。
 */
function calculateKeywordDensity(html: string, keyword: string): { density: number; keywordCount: number } {
  const textOnly = html.replace(/<[^>]+>/g, '')
  if (!textOnly || !keyword) return { density: 0, keywordCount: 0 }
  const keywordCount = (textOnly.match(new RegExp(escapeRegExp(keyword), 'g')) || []).length
  const density = (keywordCount * keyword.length) / textOnly.length * 100
  return { density, keywordCount }
}

/**
 * HTML 属性转义，避免 alt 里的引号/尖括号破坏 <img> 标签
 */
function escapeHtmlAttr(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * 在本站媒体列表里挑一张「符合」的配图：
 * 优先选 alt 文本与关键词/标题相关的；没有相关图再随机取一张。
 * 调用方已按 site 过滤，这里只在传入的本站图里挑，绝不跨站乱选。
 */
function pickRelevantMedia(docs: any[], keyword: string, title: string): any {
  const tokens = `${keyword} ${title}`
    .toLowerCase()
    .split(/[\s，,。：:、!！?？\-—_]+/)
    .filter((t) => t && t.length >= 2)
  const relevant = docs.filter((m) => {
    const alt = String(m.alt || '').toLowerCase()
    return alt && tokens.some((t) => alt.includes(t))
  })
  const pool = relevant.length > 0 ? relevant : docs
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * 把配图插进正文，作为「文中第一张图」：优先插在引言第一段（第一个 </p>）之后，
 * 找不到 </p> 就插在第一个 </h2> 之后，再不行就放到最前面。
 */
function insertImageIntoContent(html: string, imgUrl: string, alt: string): string {
  const fig = `<figure class="article-image"><img src="${imgUrl}" alt="${escapeHtmlAttr(alt)}" loading="lazy" /></figure>`
  const pEnd = html.indexOf('</p>')
  if (pEnd !== -1) return html.slice(0, pEnd + 4) + '\n' + fig + '\n' + html.slice(pEnd + 4)
  const h2End = html.indexOf('</h2>')
  if (h2End !== -1) return html.slice(0, h2End + 5) + '\n' + fig + '\n' + html.slice(h2End + 5)
  return fig + '\n' + html
}

/**
 * 生成SEO优化的文章（两步走：关键词→标题→文章内容）
 * 符合百度/Google SEO标准 + AEO收录标准
 */
export async function generateArticle(params: GenerateArticleParams): Promise<GenerateResult> {
  const startTime = Date.now()
  const { siteId, configId, payload, triggerType = 'cron' } = params

  let logId: string | number | undefined
  let keywordDoc: any = null

  try {
    // 1. 获取生成配置
    const config = await payload.findByID({
      collection: 'generate-configs',
      id: configId,
    })
    if (!config) return { success: false, error: '生成配置不存在' }

    // 2. 获取站点信息
    const site = await payload.findByID({
      collection: 'sites',
      id: siteId,
    })
    if (!site) return { success: false, error: '站点不存在' }

    // 3. 随机选择关键词
    keywordDoc = await pickRandomKeyword({ siteId, payload })
    if (!keywordDoc) return { success: false, error: '没有可用的关键词' }

    const keyword = keywordDoc.keyword as string

    // 4. 标记关键词为已占用
    await markKeywordReserved(keywordDoc.id, payload)

    // 5. 检查相似度
    const isTooSimilar = await checkKeywordSimilarity(keyword, siteId, payload)
    if (isTooSimilar) {
      await markKeywordUsed(keywordDoc.id, 'skipped-similar', payload)
      return {
        success: false,
        keyword,
        error: '关键词与近期内容相似度太高，已跳过',
        duration: (Date.now() - startTime) / 1000,
      }
    }

    // 6. 创建生成日志（进行中）
    const logDoc = await payload.create({
      collection: 'generate-logs',
      data: {
        site: siteId,
        config: configId,
        keyword,
        status: 'running',
        triggerType,
      },
    })
    logId = logDoc.id

    const siteName = (config.siteName as string) || (site.name as string)
    const siteDescription = (site.description as string) || ''
    const siteKeywords = (config.siteKeywords as string)?.split('\n').filter(Boolean) || []
    const siteDomain = (site as any).domain || ''

    // ========== 第一步：根据关键词生成标题 ==========
    console.log(`[生成] 关键词: ${keyword} → 生成标题...`)
    const titleMessages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一位SEO专家，擅长撰写吸引点击的SEO标题。
要求：
1. 标题必须包含关键词"${keyword}"
2. 标题长度不超过12个汉字（含标点）
3. 标题要有吸引力，让人想点击
4. 符合百度/Google SEO标准
5. 不要使用"！"等过度夸张符号
6. 直接输出标题，不要加引号，不要任何解释`,
      },
      {
        role: 'user',
        content: `网站：${siteName}（${siteDescription}）
关键词：${keyword}
相关领域：${siteKeywords.slice(0, 5).join('、')}

请根据以上关键词生成一个SEO优化标题。直接输出标题即可。`,
      },
    ]

    const titleResponse = await chatCompletion(payload, titleMessages, {
      temperature: 0.8,
      maxTokens: 300,
      purpose: 'generate_title',
      siteId,
    })

    let articleTitle = titleResponse.content
      .replace(/^[""''「『【\s]+|[""''」』】\s]+$/g, '')
      .replace(/\n/g, '')
      .trim()

    if (!articleTitle || articleTitle.length < 5) {
      throw new Error('标题生成失败，内容为空')
    }

    // 标题不超过12个汉字
    const chineseChars = articleTitle.replace(/[^\u4e00-\u9fa5]/g, '')
    if (chineseChars.length > 12) {
      let count = 0
      let cutIndex = 0
      for (let i = 0; i < articleTitle.length; i++) {
        if (/[\u4e00-\u9fa5]/.test(articleTitle[i])) {
          count++
          if (count > 12) { cutIndex = i; break }
        }
        cutIndex = i + 1
      }
      articleTitle = articleTitle.slice(0, cutIndex).replace(/[\s、，。\-—]+$/, '')
      console.log(`[生成] 标题超过12个汉字，截取为: ${articleTitle}`)
    }

    // 确保标题包含关键词
    if (!articleTitle.includes(keyword)) {
      articleTitle = `${keyword}：${articleTitle}`
      console.log(`[生成] 标题未包含关键词，已补充: ${articleTitle}`)
    }

    console.log(`[生成] 标题: ${articleTitle}`)

    // ========== 第二步：根据标题生成完整文章 ==========
    console.log(`[生成] 标题: ${articleTitle} → 生成文章内容...`)

    // 获取已有文章（用于内链）
    const existingArticles = await payload.find({
      collection: 'articles',
      where: {
        site: { equals: siteId },
        status: { equals: 'published' },
      },
      limit: 10,
      sort: '-publishedAt',
    })

    const internalLinksRef = existingArticles.docs.map((a: any) => ({
      title: a.title,
      slug: a.slug,
    }))

    const contentMessages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一位专业的SEO内容创作专家，擅长撰写符合百度/Google SEO标准且满足AEO（Answer Engine Optimization）收录要求的高质量文章。

写作风格要求：
1. 内容像真人专家撰写，避免AI生成的典型特征（不要过度使用"首先"、"其次"、"总之"等连接词）
2. 使用第一人称经验分享，加入个人观点和见解
3. 穿插具体案例、数据来增强可信度
4. 语言自然流畅，有情感温度
5. 适当使用口语化表达
6. 加入独特案例或行业内部信息，体现原创性

SEO要求：
1. 文章结构清晰，使用<h2><h3>分层，每段控制在100-200字
2. 核心关键词"${keyword}"在标题、引言、正文、总结中自然融入即可；以读起来流畅、对读者有价值为准，不要为了凑次数而刻意堆砌，也不要完全回避不提
3. 必须包含：引言（100字左右）、正文（3-5个小节）、总结
4. 至少包含1个数据对比表格（HTML <table>格式，带<thead><tbody>）
5. 适当使用<ul><li>列表、<strong>粗体强调
6. 在文章中引用权威数据来源（如行业协会、官方机构、研究报告）

AEO收录标准（满足AI搜索引擎收录）：
1. 开头直接回答问题，提供明确结论
2. 使用问答式结构（FAQ格式）
3. 提供具体的数据、步骤、方法
4. 使用简洁的定义句解释专业术语
5. 添加Schema.org结构化数据标记

内链要求：
${internalLinksRef.length > 0
  ? `在文章中自然插入2-3个内链，使用 <a href="/${internalLinksRef[0].slug}">锚文本</a> 格式。可用文章：\n${internalLinksRef.map((l, i) => `${i + 1}. 《${l.title}》 → /${l.slug}`).join('\n')}`
  : '暂无其他文章可链接。'}

输出格式：直接输出HTML内容，使用<h2><h3><p><ul><table>等标签。不要输出 <img> 图片标签（配图由系统自动插入）。不要输出任何前言、解释或markdown标记。`,
      },
      {
        role: 'user',
        content: `网站：${siteName}
网站简介：${siteDescription}
文章标题：${articleTitle}
核心关键词：${keyword}
相关关键词：${siteKeywords.slice(0, 8).join('、')}
字数要求：${config.articleMinLength || 1500}-${config.articleMaxLength || 3000}字

请根据以上标题撰写完整的SEO优化文章。直接输出HTML内容。`,
      },
    ]

    const contentResponse = await chatCompletion(payload, contentMessages, {
      temperature: 0.7,
      maxTokens: 4000,
      purpose: 'generate_article',
      siteId,
    })

    let articleContent = contentResponse.content

    if (!articleContent || articleContent.length < 500) {
      throw new Error('文章内容太短或为空')
    }

    console.log(`[生成] 文章长度: ${articleContent.length} 字符`)

    // ========== 第三步：关键词密度检测（仅记录，不强制） ==========
    // 按需求：不强制关键词密度，只要文章流畅、符合 SEO + AEO 标准即可。
    // 这里仅计算并记录密度用于监控，不再据此重生成——避免 AI 为凑密度而"报复性堆砌"
    // （实测曾因"密度过低→补词"逻辑，导致密度从 1% 被顶到 13%）。
    const { density, keywordCount } = calculateKeywordDensity(articleContent, keyword)
    console.log(`[生成] 关键词密度(仅监控): ${density.toFixed(2)}% (出现 ${keywordCount} 次)`)

    // ========== 第四步：生成摘要和SEO字段 ==========
    const excerpt = generateExcerpt(articleContent)
    const metaTitle = articleTitle.length > 60 ? articleTitle.slice(0, 60) : articleTitle
    const metaDescription = excerpt.slice(0, 150)
    const metaKeywords = `${keyword}, ${siteKeywords.slice(0, 4).join(', ')}`
    const slug = await generateUniqueSlug(keyword, articleTitle, siteId, payload)

    // ========== 第五步：选图并插入正文 ==========
    // 只在本站媒体库里选图（按 site 过滤，绝不跨站乱选）；优先挑 alt 与关键词/标题
    // 相关的「符合」的图，没有相关图再随机。把选中的图作为正文第一张图插入，
    // 同时设为封面图 —— 缩略图即文章第一张图。
    const serverURL = payload.config.serverURL || process.env.NEXT_PUBLIC_SERVER_URL || ''
    const siteMedia = await payload.find({
      collection: 'media',
      where: { site: { equals: siteId } },
      limit: 100,
      depth: 0,
    })

    const usableMedia = siteMedia.docs.filter((m: any) => m && m.url)
    let coverImageId: string | number | undefined
    if (usableMedia.length > 0) {
      const picked = pickRelevantMedia(usableMedia, keyword, articleTitle)
      coverImageId = picked.id
      const imgUrl = /^https?:\/\//.test(picked.url) ? picked.url : `${serverURL}${picked.url}`
      const imgAlt = (picked.alt as string) || keyword || articleTitle
      articleContent = insertImageIntoContent(articleContent, imgUrl, imgAlt)
      console.log(`[生成] 已插入配图(本站媒体): ${imgUrl} (媒体ID ${coverImageId})`)
    } else {
      console.log(`[生成] 本站媒体库无可用图片，跳过配图`)
    }

    // ========== 第六步：生成JSON-LD结构化数据 ==========
    const jsonLd = generateJsonLd({
      title: articleTitle,
      description: metaDescription,
      keyword,
      siteName,
      siteDomain,
      slug,
    })

    // ========== 第七步：创建文章 ==========
    const article = await payload.create({
      collection: 'articles',
      data: {
        title: articleTitle,
        slug,
        content: articleContent,
        excerpt,
        coverImage: coverImageId,
        site: siteId,
        status: config.autoPublish ? 'published' : 'draft',
        publishedAt: config.autoPublish ? new Date().toISOString() : undefined,
        sourceKeyword: keyword,
        metaTitle,
        metaDescription,
        metaKeywords,
        jsonLd,
      },
    })

    // 8. 标记关键词为已使用
    await markKeywordUsed(keywordDoc.id, article.id, payload)

    // 9. 更新生成日志
    const duration = (Date.now() - startTime) / 1000
    await payload.update({
      collection: 'generate-logs',
      id: logId,
      data: {
        status: 'success',
        article: article.id,
        duration,
      },
    })

    console.log(`[生成] ✅ 完成: "${articleTitle}" (${duration.toFixed(1)}秒)`)

    return {
      success: true,
      articleId: article.id,
      keyword,
      title: articleTitle,
      duration,
    }
  } catch (error: any) {
    const duration = (Date.now() - startTime) / 1000
    const errorMessage = error.message || String(error)

    if (logId) {
      try {
        await payload.update({
          collection: 'generate-logs',
          id: logId,
          data: { status: 'failed', errorMessage, duration },
        })
      } catch {}
    }

    if (keywordDoc?.id) {
      try {
        await payload.update({
          collection: 'generate-keywords',
          id: keywordDoc.id,
          data: { status: 'pending' },
        })
      } catch {}
    }

    console.error(`[生成]  失败: ${errorMessage}`)

    return {
      success: false,
      error: errorMessage,
      duration,
    }
  }
}

/**
 * 从HTML内容中提取摘要
 */
function generateExcerpt(html: string): string {
  const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  return text.slice(0, 200)
}

/**
 * 将关键词/标题转写为 ASCII slug 基（中文→拼音，无声调）
 * 旧实现用硬编码拼音映射表（仅 ~90 字），未覆盖的字会原样保留成中文，
 * 导致 URL 里混进中文字符、且不同关键词可能转写成相同基 → slug 撞车。
 * 改用 pinyin-pro 完整转写，再由 generateUniqueSlug 保证全局唯一。
 */
function toSlugBase(input: string): string {
  if (!input) return ''
  const latin = pinyin(input, { toneType: 'none', type: 'string', nonZh: 'consecutive' })
    .toLowerCase()
    .trim()
  const base = latin
    .replace(/[^a-z0-9]+/g, '-') // 非字母数字统一成连字符
    .replace(/^-+|-+$/g, '') // 去首尾连字符
  return base.slice(0, 40)
}

/**
 * 生成全局唯一的 SEO slug：基 + 日期；若已存在则追加 -2 / -3 ...
 * Articles.slug 是全局 unique，撞车会让 payload.create 抛错，关键词被重置为
 * pending 后下次又被选中 → 无限失败循环，因此必须保证唯一。
 */
async function generateUniqueSlug(
  keyword: string | undefined,
  title: string,
  siteId: string | number,
  payload: Payload,
): Promise<string> {
  const now = new Date()
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const rawBase = toSlugBase(keyword || title) || 'article'
  let candidate = `${rawBase}-${dateStr}`
  let n = 2
  // 最多尝试 20 次，避免极端情况下死循环
  while (n <= 21) {
    const hit = await payload.find({
      collection: 'articles',
      where: { slug: { equals: candidate } },
      limit: 1,
      depth: 0,
    })
    if (hit.docs.length === 0) break
    candidate = `${rawBase}-${dateStr}-${n}`
    n++
  }
  return candidate
}

/**
 * 生成JSON-LD结构化数据（Schema.org Article）
 */
function generateJsonLd(params: {
  title: string
  description: string
  keyword: string
  siteName: string
  siteDomain: string
  slug: string
}): string {
  const { title, description, keyword, siteName, siteDomain, slug } = params
  const url = siteDomain ? `https://${siteDomain}/${slug}` : `/${slug}`

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: description,
    keyword: keyword,
    author: {
      '@type': 'Organization',
      name: siteName,
    },
    publisher: {
      '@type': 'Organization',
      name: siteName,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    datePublished: new Date().toISOString(),
    dateModified: new Date().toISOString(),
  }

  return JSON.stringify(schema)
}

/**
 * 批量生成文章
 */
export async function generateBatchArticles(params: {
  siteId: string | number
  configId: string | number
  count: number
  payload: Payload
  triggerType?: 'cron' | 'manual' | 'api'
}): Promise<{ success: number; failed: number; results: GenerateResult[] }> {
  const { siteId, configId, count, payload, triggerType = 'cron' } = params
  const results: GenerateResult[] = []
  let success = 0
  let failed = 0

  for (let i = 0; i < count; i++) {
    const result = await generateArticle({
      siteId,
      configId,
      payload,
      triggerType,
    })
    results.push(result)

    if (result.success) {
      success++
    } else {
      failed++
      if (failed >= 3 && success === 0) break
    }

    if (i < count - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  return { success, failed, results }
}
