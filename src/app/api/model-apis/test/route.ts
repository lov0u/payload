import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

export const dynamic = 'force-dynamic'

/**
 * 测试单个模型 API 连通性。
 * body 传 { id } 时从 model-apis 取配置；
 * 也支持直接传 { apiUrl, apiKey, model } 即时测试（新建/编辑前先验证）。
 * 仅做一次最小调用，不写 model-usage-logs，避免污染统计。
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    let apiUrl: string
    let apiKey: string
    let model: string

    const payload = await getPayload({ config: configPromise })

    if (body.id) {
      const doc = await payload.findByID({
        collection: 'model-apis',
        id: body.id,
      })
      apiUrl = (doc as any).apiUrl
      apiKey = (doc as any).apiKey
      model = (doc as any).model
    } else {
      apiUrl = body.apiUrl
      apiKey = body.apiKey
      model = body.model
    }

    if (!apiUrl || !apiKey || !model) {
      return NextResponse.json(
        { success: false, error: '缺少 apiUrl / apiKey / model' },
        { status: 400 },
      )
    }

    const url = apiUrl.endsWith('/chat/completions')
      ? apiUrl
      : `${apiUrl.replace(/\/$/, '')}/chat/completions`

    const startTime = Date.now()
    let httpStatus = 0
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          stream: false,
          temperature: 0.5,
          max_tokens: 200,
          messages: [
            { role: 'system', content: '你是一个测试助手，只回复两个字：正常' },
            { role: 'user', content: 'ping' },
          ],
        }),
      })
      httpStatus = res.status
      if (!res.ok) {
        const errText = await res.text()
        return NextResponse.json({
          success: false,
          model,
          latencyMs: Date.now() - startTime,
          httpStatus,
          error: `HTTP ${res.status}: ${errText.slice(0, 300)}`,
        })
      }
      const data = await res.json()
      const content = data?.choices?.[0]?.message?.content || ''
      const usage = data?.usage || null
      return NextResponse.json({
        success: true,
        model,
        latencyMs: Date.now() - startTime,
        httpStatus,
        sample: content.slice(0, 120),
        usage,
      })
    } catch (e: any) {
      return NextResponse.json({
        success: false,
        model,
        latencyMs: Date.now() - startTime,
        httpStatus,
        error: e?.message || String(e),
      })
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '测试失败' },
      { status: 500 },
    )
  }
}
