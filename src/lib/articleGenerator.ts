import type { Payload } from 'payload'
import { chatCompletion, type ChatMessage } from './openaiClient'
import { pickRandomKeyword, markKeywordUsed, markKeywordReserved, checkKeywordSimilarity } from './keywordPicker'

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

// 辅助函数：转义正则表达式特殊字符
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 辅助函数：带重试的 AI 调用
async function chatCompletionWithRetry(
  payload: Payload,
  messages: ChatMessage[],
  options: {
    temperature?: number
    maxTokens?: number
    purpose?: string
    siteId?: string | number
    maxRetries?: number
  }
): Promise<{ content: string; tokens: number; modelId: string | number; modelName: string }> {
  const { maxRetries = 3, ...rest } = options
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await chatCompletion(payload, messages, rest)
      if (response.content && response.content.trim().length > 0) {
        return response
      }
      throw new Error('AI 返回内容为空')
    } catch (error: any) {
      lastError = error
      console.log(`[重试] 第 ${attempt}/${maxRetries} 次尝试失败: ${error.message}`)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt)) // 递增延迟
      }
    }
  }

  throw lastError || new Error('AI 调用失败')
}

export async function generateArticle(params: GenerateArticleParams): Promise<GenerateResult> {
  const startTime = Date.now()
  const { siteId, configId, payload, triggerType = 'cron' } = params

  let logId: string | number | undefined
  let keywordDoc: any = null

  try {
    const config = await payload.findByID({
      collection: 'generate-configs',
      id: configId,
    })
    if (!config) return { success: false, error: '生成配置不存在' }

    const site = await payload.findByID({
      collection: 'sites',
      id: siteId,
    })
    if (!site) return { success: false, error: '站点不存在' }

    keywordDoc = await pickRandomKeyword({ siteId, payload })
    if (!keywordDoc) return { success: false, error: '没有可用的关键词' }

    const keyword = keywordDoc.keyword as string
    await markKeywordReserved(keywordDoc.id, payload)

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

    // 第一步：生成标题（带重试机制）
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

    const titleResponse = await chatCompletionWithRetry(payload, titleMessages, {
      temperature: 0.8,
      maxTokens: 4096,
      purpose: 'generate_title',
      siteId,
      maxRetries: 3,
    })

    let articleTitle = titleResponse.content
      .replace(/^[""''「『【\s]+|[""''」』】\s]+$/g, '')
      .replace(/\n/g, '')
      .trim()

    if (!articleTitle || articleTitle.length < 5) {
      throw new Error('标题生成失败，内容为空')
    }

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

    if (!articleTitle.includes(keyword)) {
      articleTitle = `${keyword}：${articleTitle}`
      console.log(`[生成] 标题未包含关键词，已补充: ${articleTitle}`)
    }

    console.log(`[生成] 标题: ${articleTitle}`)

    // 第二步：生成文章内容
    console.log(`[生成] 标题: ${articleTitle} → 生成文章内容...`)

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

    // 修复 #4：改进内链逻辑，提供多个链接选项
    const linkExamples = internalLinksRef.slice(0, 5).map((l, i) =>
      `${i + 1}. 《${l.title}》 → <a href="/${l.slug}">${l.title}</a>`
    ).join('\n')

    const contentMessages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一位专业的SEO内容创作专家，擅长撰写符合百度/Google SEO标准且满足AEO收录要求的高质量文章。

写作风格要求：
1. 内容像真人专家撰写，避免AI生成的典型特征
2. 使用第一人称经验分享，加入个人观点和见解
3. 穿插具体案例、数据来增强可信度
4. 语言自然流畅，有情感温度
5. 适当使用口语化表达

SEO要求：
1. 文章结构清晰，使用<h2><h3>分层，每段控制在100-200字
2. 关键词"${keyword}"自然分布，密度控制在2%-5%
3. 必须包含：引言（100字左右）、正文（3-5个小节）、总结
4. 至少包含1个数据对比表格（HTML <table>格式）
5. 适当使用<ul><li>列表、<strong>粗体强调

AEO收录标准：
1. 开头直接回答问题，提供明确结论
2. 使用问答式结构（FAQ格式）
3. 提供具体的数据、步骤、方法
4. 添加Schema.org结构化数据标记

内链要求：
${internalLinksRef.length > 0
  ? `在文章中自然插入2-3个内链，从以下链接中选择：\n${linkExamples}\n使用格式：<a href="/文章slug">锚文本</a>`
  : '暂无其他文章可链接。'}

输出格式：直接输出HTML内容，使用<h2><h3><p><ul><table>等标签。不要输出任何前言、解释或markdown标记。`,
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

    const contentResponse = await chatCompletionWithRetry(payload, contentMessages, {
      temperature: 0.7,
      maxTokens: 4000,
      purpose: 'generate_article',
      siteId,
      maxRetries: 2,
    })

    let articleContent = contentResponse.content

    if (!articleContent || articleContent.length < 500) {
      throw new Error('文章内容太短或为空')
    }

    console.log(`[生成] 文章长度: ${articleContent.length} 字符`)

    // 修复 #2：关键词密度检测（转义正则特殊字符）
    const textOnly = articleContent.replace(/<[^>]+>/g, '')
    const escapedKeyword = escapeRegExp(keyword)
    const keywordCount = (textOnly.match(new RegExp(escapedKeyword, 'g')) || []).length
    const density = (keywordCount / textOnly.length) * 100
    console.log(`[生成] 关键词密度: ${density.toFixed(2)}% (目标2%-5%)`)

    if (density < 1.5) {
      console.log(`[生成] 关键词密度过低，重新生成...`)
      const retryMessages: ChatMessage[] = [
        {
          role: 'system',
          content: `你是一位专业的SEO内容创作专家。请重新撰写文章，确保关键词"${keyword}"的密度达到2%-5%。
直接输出HTML内容。`,
        },
        {
          role: 'user',
          content: `文章标题：${articleTitle}
核心关键词：${keyword}
字数要求：${config.articleMinLength || 1500}-${config.articleMaxLength || 3000}字

请重新撰写，确保关键词密度达标。直接输出HTML内容。`,
        },
      ]

      const retryResponse = await chatCompletionWithRetry(payload, retryMessages, {
        temperature: 0.7,
        maxTokens: 4000,
        purpose: 'generate_article_retry',
        siteId,
        maxRetries: 2,
      })

      if (retryResponse.content && retryResponse.content.length > 500) {
        articleContent = retryResponse.content
        console.log(`[生成] 重新生成后文章长度: ${articleContent.length} 字符`)
      }
    }

    // 生成摘要和SEO字段
    const excerpt = generateExcerpt(articleContent)
    const metaTitle = articleTitle.length > 60 ? articleTitle.slice(0, 60) : articleTitle
    const metaDescription = excerpt.slice(0, 150)
    const metaKeywords = `${keyword}, ${siteKeywords.slice(0, 4).join(', ')}`
    const slug = generateSEOSlug(articleTitle, keyword)

    // 修复 #5：优化封面图选择，避免重复
    const siteMedia = await payload.find({
      collection: 'media',
      where: { site: { equals: siteId } },
      limit: 100,
    })

    // 获取最近文章使用的图片ID
    const usedMediaIds = existingArticles.docs
      .map((a: any) => a.coverImage)
      .filter(Boolean)

    // 过滤出未使用的图片
    const availableMedia = siteMedia.docs.filter(
      (m: any) => !usedMediaIds.includes(m.id)
    )

    let coverImageId: string | number | undefined
    const mediaPool = availableMedia.length > 0 ? availableMedia : siteMedia.docs
    if (mediaPool.length > 0) {
      const randomIndex = Math.floor(Math.random() * mediaPool.length)
      coverImageId = mediaPool[randomIndex].id
    }

    // 生成JSON-LD
    const jsonLd = generateJsonLd({
      title: articleTitle,
      description: metaDescription,
      keyword,
      siteName,
      siteDomain,
      slug,
    })

    // 创建文章
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

    await markKeywordUsed(keywordDoc.id, article.id, payload)

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

    console.log(`[生成] 完成: "${articleTitle}" (${duration.toFixed(1)}秒)`)

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

    console.error(`[生成] 失败: ${errorMessage}`)

    return {
      success: false,
      error: errorMessage,
      duration,
    }
  }
}

function generateExcerpt(html: string): string {
  const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  return text.slice(0, 200)
}

// 修复 #3：完善 slug 生成的拼音转换
function generateSEOSlug(title: string, keyword?: string): string {
  const now = new Date()
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`

  let base = keyword || title
  base = base.replace(/[^\w\u4e00-\u9fa5]/g, '')

  // 扩展的拼音映射表（覆盖更常用的字符）
  const pinyinMap: Record<string, string> = {
    // 宠物相关
    '宠': 'chong', '物': 'wu', '美': 'mei', '容': 'rong', '犬': 'quan', '舍': 'she',
    '幼': 'you', '选': 'xuan', '购': 'gou', '纯': 'chun', '种': 'zhong', '猫': 'mao',
    '狗': 'gou', '训': 'xun', '练': 'lian', '养': 'yang', '护': 'hu', '理': 'li',
    // 玉石相关
    '玉': 'yu', '器': 'qi', '定': 'ding', '制': 'zhi', '翡': 'fei', '翠': 'cui',
    '鉴': 'jian', '别': 'bie', '和': 'he', '田': 'tian', '价': 'jia', '格': 'ge',
    '宝': 'bao', '珠': 'zhu', '收': 'shou', '藏': 'cang',
    // 回收相关
    '回': 'hui', '废': 'fei', '铜': 'tong', '铝': 'lv', '铁': 'tie', '电': 'dian',
    '缆': 'lan', '设': 'she', '备': 'bei', '资': 'zi', '品': 'pin', '再': 'zai',
    '生': 'sheng', '金': 'jin', '属': 'shu', '工': 'gong', '业': 'ye', '料': 'liao',
    // 汽车相关
    '二': 'er', '手': 'shou', '车': 'che', '汽': 'qi', '销': 'xiao', '售': 'shou',
    '保': 'bao', '新': 'xin', '能': 'neng', '源': 'yuan', '试': 'shi', '驾': 'jia',
    '配': 'pei', '置': 'zhi', '油': 'you', '耗': 'hao', '对': 'dui', '比': 'bi',
    // 生活百科
    '知': 'zhi', '识': 'shi', '健': 'jian', '康': 'kang', '活': 'huo', '百': 'bai',
    '科': 'ke', '实': 'shi', '用': 'yong', '指': 'zhi', '南': 'nan', '经': 'jing',
    '验': 'yan', '分': 'fen', '享': 'xiang', '小': 'xiao', '窍': 'qiao', '门': 'men',
    '家': 'jia', '居': 'ju', '清': 'qing', '洁': 'jie', '纳': 'na',
    '整': 'zheng', '饮': 'yin', '食': 'shi', '医': 'yi', '疗': 'liao',
    // 杜宾犬相关
    '杜': 'du', '宾': 'bin', '多': 'duo', '少': 'shao', '钱': 'qian', '好': 'hao',
    '忠': 'zhong', '诚': 'cheng', '度': 'du', '卫': 'wei', '图': 'tu', '片': 'pian',
    '性': 'xing', '命': 'ming', '体': 'ti', '重': 'zhong', '特': 'te', '征': 'zheng',
    '方': 'fang', '法': 'fa', '注': 'zhu', '意': 'yi', '事': 'shi', '项': 'xiang',
    // 通用字符
    '的': 'de', '是': 'shi', '在': 'zai', '有': 'you', '不': 'bu', '这': 'zhe',
    '中': 'zhong', '大': 'da', '来': 'lai', '上': 'shang', '国': 'guo', '个': 'ge',
    '到': 'dao', '说': 'shuo', '们': 'men', '为': 'wei', '子': 'zi', '会': 'hui',
    '出': 'chu', '也': 'ye', '对': 'dui', '着': 'zhe', '就': 'jiu', '年': 'nian',
    '那': 'na', '要': 'yao', '下': 'xia', '以': 'yi', '得': 'de', '过': 'guo',
    '地': 'di', '方': 'fang', '后': 'hou', '自': 'zi', '然': 'ran', '学': 'xue',
  }

  let slugBase = ''
  for (const char of base) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      slugBase += pinyinMap[char] || '' // 未映射的字符直接跳过
    } else {
      slugBase += char.toLowerCase()
    }
  }

  // 如果 slug 为空，使用日期
  if (!slugBase) {
    slugBase = 'article'
  }

  slugBase = slugBase.slice(0, 30)
  return `${slugBase}-${dateStr}`
}

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
