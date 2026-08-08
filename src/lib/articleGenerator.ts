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
 * 清洗标题：去掉模型可能夹带的元指令废话（字数统计/序号/引号/旁注）。
 * 返回第一行纯文本，并尽量提取包含关键词的干净片段。
 */
function stripTitleJunk(t: string): string {
  return (t || '')
    .replace(/^\s*[-–—]*\s*/, '')
    .replace(/^\s*\d+[\.、)]\s*/, '')
    .replace(/[“"”'‘’「」『』【】]/g, '')
    .replace(/[（(][^（）()]*\d+\s*字[^（）()]*[）)]/g, '')
    .replace(/\d+\s*个字?/g, '')
    .replace(/字数[：:]?\s*\d+/g, '')
    .replace(/\s*[-—–]\s*(简洁|优选|但|注|说明|即|或|及)[^，。\n]*$/g, '')
    // 去掉末尾逗号/句号后拼接的旁注废话（也是、简洁、但、说明…）
    .replace(/(?:，|,|。|\.|、)\s*(也是|简洁|但|说明|即|优选|注|不过|其实|通常|换言之)[^，。\n]*$/g, '')
    // 去掉直接拼接在标题结尾的废话词
    .replace(/(也是|简洁|但|说明|即|优选|注)$/g, '')
    .replace(/[（）()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractCleanTitle(raw: string, keyword: string): string {
  const src = (raw || '').replace(/\r/g, '\n')
  const lines = src.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const cands: string[] = []
  for (const line of lines) {
    const byNum = line.split(/(?:\s|^)\d+[\.、)]\s+/)
    for (const part of byNum) {
      for (const sub of part.split(/\s*[-—–]\s*/)) {
        const t = sub.trim()
        if (t) cands.push(t)
      }
    }
  }
  const cleaned = cands.map(stripTitleJunk).filter(Boolean)
  if (cleaned.length === 0) return ''
  const scored = cleaned.map((t) => ({
    t,
    hasKw: t.includes(keyword),
    bad: /\d/.test(t) || /字/.test(t) || /[（）()=＝]/.test(t),
    cnLen: t.replace(/[^\u4e00-\u9fa5]/g, '').length,
  }))
  const good = scored.filter((s) => s.hasKw && !s.bad && s.cnLen >= 4 && s.cnLen <= 14)
  if (good.length) {
    good.sort((a, b) => Math.abs(a.cnLen - 8) - Math.abs(b.cnLen - 8))
    return good[0].t
  }
  const kw = scored.filter((s) => s.hasKw)
  if (kw.length) return kw[0].t
  return cleaned[0]
}

function buildFallbackTitle(keyword: string): string {
  const templates = ['全面解析', '实用指南', '全攻略', '怎么选', '入门到精通']
  const idx = keyword.length % templates.length
  return `${keyword}${templates[idx]}`
}

function cleanTitle(raw: string, keyword: string): string {
  let t = (raw || '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0) || (raw || '')

  t = t
    .replace(/^\s*\d+[\.、)]\s*/, '')                                 // 开头序号 "7. " "1、"
    .replace(/[（(][^（）()]*\d+\s*字[^（）()]*[）)]/g, '')             // （7字）/ (8字)
    .replace(/[“"”'‘’「」『』【】]/g, '')                             // 各类引号
    .replace(/\s*[-—–]\s*(简洁|优选|但|注|说明|即)[^，。\n]*$/g, '')     // 残尾 "- 简洁8." / "- 但品"
    .replace(/[（）()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // 仍含字数/等号/序号等残留时，按分隔符切分并取包含关键词的片段
  if (/字数|＝|=|[（(]?\d+字|序号|选项/.test(t)) {
    const parts = t.split(/(字数|＝|=|[（(]?\d+字|序号|选项)/)
    const realPart = parts.find((p) => p && p.includes(keyword)) || t
    t = (realPart || t).replace(/^[：:、，。\s]+/, '').trim()
  }

  return t
}

/**
 * 判断清洗后的标题是否仍不合格：
 * 长度过短、不含关键词、或残留字数统计/序号/旁注痕迹。
 */
function isTitleMalformed(title: string, keyword: string): boolean {
  if (!title || title.length < 4) return true
  if (!title.includes(keyword)) return true
  if (/\d+\s*字/.test(title)) return true
  if (/字[：:]?\s*\d/.test(title)) return true
  if (/(序号|选项|简洁|也是|但品|说明|即|优选|注[：:]|＝|不过|其实|通常|换言之)/.test(title)) return true
  return false
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
 * 把配图插进正文：默认插到「第三个 H2 标题」的上方（H2 不足 3 个则插到最后一个 H2 上方，
 * 再没有 H2 就放到最前面）。图片尺寸由前端 .article-image 容器统一约束为 21:9。
 */
function insertImageIntoContent(html: string, imgUrl: string, alt: string): string {
  const fig = `<figure class="article-image"><img src="${imgUrl}" alt="${escapeHtmlAttr(alt)}" loading="lazy" /></figure>`
  // 收集所有 <h2> 起始位置，把配图插到第三个 H2 之前
  const h2Starts: number[] = []
  const re = /<h2[\s>]/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) h2Starts.push(m.index)
  if (h2Starts.length >= 3) {
    const pos = h2Starts[2]
    return html.slice(0, pos) + '\n' + fig + '\n' + html.slice(pos)
  }
  if (h2Starts.length >= 1) {
    const pos = h2Starts[h2Starts.length - 1]
    return html.slice(0, pos) + '\n' + fig + '\n' + html.slice(pos)
  }
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
        content: `你是一位SEO专家，只负责输出一个文章标题。
要求：
1. 标题必须包含关键词"${keyword}"
2. 标题长度不超过12个汉字（含标点）
3. 标题要有吸引力，让人想点击
4. 符合百度/Google SEO标准，不要使用"！"等过度夸张符号
5. 严禁输出任何额外内容：不要加引号、不要序号、不要列多个选项、绝对不要输出"1. ... 2. ..."这样的选项列表、绝对不要写"（8字）""10个字"之类的字数说明、不要写"简洁/但/说明"等旁注、不要任何解释
6. 只返回标题本身这一行纯文本
7. 标题角度要多样化，不要总用"XX揭秘/全攻略/指南/全面解析"这类套路；可换"怎么选/避坑/实测/XX值不值"等更自然的切入`,
      },
      {
        role: 'user',
        content: `网站：${siteName}（${siteDescription}）
关键词：${keyword}
相关领域：${siteKeywords.slice(0, 5).join('、')}

请只返回一个SEO优化标题文本（只要标题，不要其他任何内容）。`,
      },
    ]

    const titleResponse = await chatCompletion(payload, titleMessages, {
      temperature: 0.8,
      maxTokens: 300,
      purpose: 'generate_title',
      siteId,
    })

    // 从模型输出里解析出干净标题（模型常返回多选项/字数说明，需要解析）
    let articleTitle = extractCleanTitle(titleResponse.content || '', keyword)
    console.log(`[生成] 原始标题: ${(titleResponse.content || '').replace(/\n/g, ' ').slice(0, 80)} → 清洗后: ${articleTitle}`)

    // 仍不合格（含数字/字数/缺关键词）时，用更严格的 prompt 重试一次
    if (!articleTitle || isTitleMalformed(articleTitle, keyword)) {
      console.log(`[生成] 标题疑似含元指令废话，重试生成标题...`)
      const retryTitle = await chatCompletion(payload, [
        {
          role: 'system',
          content: `只输出一个文章标题，必须包含"${keyword}"，4到12个汉字。绝对不要序号、不要多个选项、不要引号、不要任何字数说明（如"10个字"）、不要解释，只返回标题本身这一行纯文本。`,
        },
        {
          role: 'user',
          content: `关键词：${keyword}。返回标题。`,
        },
      ], { temperature: 0.5, maxTokens: 60, purpose: 'generate_title', siteId })
      const cleaned = extractCleanTitle(retryTitle.content || '', keyword)
      if (cleaned && !isTitleMalformed(cleaned, keyword)) articleTitle = cleaned
    }

    // 两次都不行，用关键词兜底拼接，保证一定有干净标题
    if (!articleTitle || isTitleMalformed(articleTitle, keyword)) {
      articleTitle = buildFallbackTitle(keyword)
      console.log(`[生成] 使用兜底标题: ${articleTitle}`)
    }

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
        content: `你是一位经验丰富的内容创作者，擅长为「${siteName}」撰写既符合搜索引擎收录、又读起来像真人写的实用文章。

【写作语气】
- 像有真实经验的作者自然分享，不要用"作为……从业者"这类套话开头，也不要每段都喊"首先/其次/总之"。
- 语言自然、有具体细节，可带一点个人观点与取舍（"我更推荐…""要注意的是…"），也可以写一段"也有人觉得…但其实…"的利弊权衡，显得有思考、不一边倒。
- 适当用类比、生活化比喻解释抽象概念，让外行也能懂。
- 不虚构数据：只有你能确定属实的常识性事实才可写；拿不准的数字、年份、比例一律不写，也不要写"据XX报告显示""XX研究表明"这种查无出处的引用。想做对比时用确知真实的量级做定性说明即可。
- 少用"据我了解/根据我的经验/我总结了一套/简单来说/总而言之"等填充套话；破折号(——)和冒号(：)不要堆砌。
- 句式要有节奏变化：长短句交错，偶尔用短句收尾，不要通篇工整的并列长句。
- 禁用过渡词：此外、与此同时、综上所述、值得一提的是、不可否认（以及首先/其次/总之）。

【SEO 结构】
- 用 <h2> 分 3–5 个自然小节，必要时 <h3> 细分；每段 100–200 字，别写成长篇大段。
- 核心关键词"${keyword}"自然出现在标题、第一个 <h2> 附近和正文里即可，流畅优先，不硬塞也不回避。
- 用 <ul><li> 列表、<strong> 强调；结构清晰、信息密度高。
- 开头两段就点明读者最关心的问题并给出实质内容（利于搜索摘要），但不要写成"直接说结论："这种格式。
- 不要重复文章标题作为第一个 <h2> 或开头第一句；直接从引入或第一个真正的小节写起。
- 每篇结构和小节标题随主题自然变化，不要每次都用"一、现状 二、推荐 三、判断 四、避坑 五、建议"的固定骨架；用描述性小节标题，而非"一、二、三"编号。

【AEO 要求（方便 AI 搜索收录）】
- 用清晰问答回答读者真实疑问；可设一个"常见问题"小节，用 <h2> 作标题、自然问句作小标题，逐条给简洁答案（不要用"FAQ："当标题）。
- 对专业词用一句大白话解释。
- 需要步骤/方法时，用有序列表或分点写清楚。

【图表（SEO 安全写法）】
- 当文中有你能确定属实的对比数据（价格、参数、占比等），除写语义化 <table>（带 <thead><tbody>）外，给该 <table> 加属性 data-chart="bar" 或 "pie" 与 data-chart-title="图表标题"；柱状图(bar)适合跨项对比，饼/环图(pie)适合占比构成，按数据性质自选。
- 用于图表的单元格只放纯数字（如 12000），单位写在表头或 data-chart-title；若原数据是区间（如 3000-12000），图表取上限值，保证能正确解析。
- 没有真实可比数据就不要画，绝不编造数字。

【不要做】
- 不要用"引言""总结""FAQ"作为标题文字。
- 不要编造统计数据、研究报告、机构名称、客户案例。
- 不要输出 <img> 图片标签（配图由系统自动插入）。
- 不要输出任何前言、解释或 markdown 标记，直接输出 HTML 正文（<h2><h3><p><ul><table> 等）。

内链要求：
${internalLinksRef.length > 0
  ? `在文章中自然插入2-3个内链，使用 <a href="/${internalLinksRef[0].slug}">锚文本</a> 格式。可用文章：\n${internalLinksRef.map((l, i) => `${i + 1}. 《${l.title}》 → /${l.slug}`).join('\n')}`
  : '暂无其他文章可链接。'}

输出格式：直接输出 HTML 正文（<h2><h3><p><ul><table> 等标签），不要输出 <img> 图片标签，也不要输出任何前言、解释或 markdown 标记。`,
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
    articleContent = sanitizeContent(articleContent)

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
        // 关键修复：Articles 集合开启 versions.drafts，公开发布状态由内部字段 _status 控制，
        // 仅设置自定义 status 字段不会让文章在公网可见。必须显式写入 _status='published'。
        _status: config.autoPublish ? 'published' : 'draft',
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
 * 清洗模型偶尔输出的 markdown 代码围栏（```html ... ```）与前后废话，
 * 避免被原样存库、前端当文本显示。
 */
function sanitizeContent(html: string): string {
  if (!html) return html
  let s = html.trim()
  s = s.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '')
  return s.trim()
}

/**
 * 从HTML内容中提取摘要（在句号/问号处截断，避免切半句）
 */
function generateExcerpt(html: string): string {
  const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  if (text.length <= 200) return text
  const cut = text.slice(0, 200)
  const m = cut.match(/.*[。！？.!?]/)
  return (m ? m[0] : cut).trim()
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
