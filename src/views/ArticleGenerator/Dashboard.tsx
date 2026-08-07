'use client'

import { useEffect, useState } from 'react'

interface SiteStat {
  site: { id: string; name: string; slug: string; enabled: boolean }
  stats: {
    pendingKeywords: number
    usedKeywords: number
    disabledKeywords: number
    totalArticles: number
    todayGenerated: number
  }
  configs: any[]
}

interface ModelStat {
  id: string | number
  name: string
  model: string
  order: number
  enabled: boolean
  totalCalls: number
  successCalls: number
  failedCalls: number
  successRate: number
  totalTokens: number
  lastUsedAt: string | null
}

interface DashboardData {
  sites: SiteStat[]
  models: ModelStat[]
  summary: {
    totalSites: number
    totalPendingKeywords: number
    totalArticles: number
    todayGenerated: number
    totalModels: number
    totalModelCalls: number
  }
}

export default function ArticleGeneratorDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingSite, setGeneratingSite] = useState<string | null>(null)

  const [importSiteId, setImportSiteId] = useState<string | null>(null)
  const [importKeywords, setImportKeywords] = useState('')
  const [importLoading, setImportLoading] = useState(false)

  const [expandSiteId, setExpandSiteId] = useState<string | null>(null)
  const [expandSeed, setExpandSeed] = useState('')
  const [expandCount, setExpandCount] = useState(10)
  const [expandLoading, setExpandLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/generator/dashboard')
      const json = await res.json()
      setData(json)
    } catch (e) {
      console.error('获取 Dashboard 数据失败:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleGenerate = async (siteId: string, configId: string) => {
    if (!confirm('确定要手动生成一篇文章吗？')) return

    setGeneratingSite(siteId)
    try {
      const res = await fetch('/api/generator/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          configId,
          count: 1,
          triggerType: 'manual',
        }),
      })
      const result = await res.json()

      if (result.success) {
        alert(`生成成功！关键词：${result.keyword}`)
        fetchData()
      } else {
        alert(`生成失败：${result.error}`)
      }
    } catch (e: any) {
      alert(`生成失败：${e.message}`)
    } finally {
      setGeneratingSite(null)
    }
  }

  const handleImportKeywords = async (siteId: string) => {
    if (!importKeywords.trim()) {
      alert('请输入关键词，每行一个')
      return
    }

    setImportLoading(true)
    try {
      const keywords = importKeywords.split('\n').map(k => k.trim()).filter(Boolean)
      const res = await fetch('/api/generator/import-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, siteId, keywordType: 'seed', sourceType: 'manual' }),
      })
      const result = await res.json()

      if (result.success) {
        alert(`导入完成！成功 ${result.successCount} 个，跳过 ${result.skipCount} 个`)
        setImportKeywords('')
        setImportSiteId(null)
        fetchData()
      } else {
        alert(`导入失败：${result.error}`)
      }
    } catch (e: any) {
      alert(`导入失败：${e.message}`)
    } finally {
      setImportLoading(false)
    }
  }

  const handleExpandKeywords = async (siteId: string) => {
    if (!expandSeed.trim()) {
      alert('请输入种子关键词')
      return
    }

    setExpandLoading(true)
    try {
      const res = await fetch('/api/generator/expand-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedKeyword: expandSeed, siteId, count: expandCount }),
      })
      const result = await res.json()

      if (result.success) {
        alert(`AI扩词完成！生成 ${result.generated.length} 个，导入 ${result.imported} 个`)
        setExpandSeed('')
        setExpandSiteId(null)
        fetchData()
      } else {
        alert(`扩词失败：${result.error}`)
      }
    } catch (e: any) {
      alert(`扩词失败：${e.message}`)
    } finally {
      setExpandLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 40 }}>加载中...</div>
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '28px' }}>SEO文章自动生成系统</h1>

      {/* 总览卡片 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
        marginBottom: '32px',
      }}>
        <div style={{ padding: '20px', background: 'var(--theme-50, #eff6ff)', borderRadius: '12px', border: '1px solid var(--theme-100, #dbeafe)' }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>站点数量</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--theme-600, #2563eb)' }}>{data?.summary.totalSites || 0}</div>
        </div>
        <div style={{ padding: '20px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>待使用关键词</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#16a34a' }}>{data?.summary.totalPendingKeywords || 0}</div>
        </div>
        <div style={{ padding: '20px', background: '#fef3c7', borderRadius: '12px', border: '1px solid #fcd34d' }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>文章总数</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#d97706' }}>{data?.summary.totalArticles || 0}</div>
        </div>
        <div style={{ padding: '20px', background: '#f3e8ff', borderRadius: '12px', border: '1px solid #d8b4fe' }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>今日已生成</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#9333ea' }}>{data?.summary.todayGenerated || 0}</div>
        </div>
        <div style={{ padding: '20px', background: '#ecfeff', borderRadius: '12px', border: '1px solid #a5f3fc' }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>模型数量</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0891b2' }}>{data?.summary.totalModels || 0}</div>
        </div>
        <div style={{ padding: '20px', background: '#fff7ed', borderRadius: '12px', border: '1px solid #fed7aa' }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>模型调用次数</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ea580c' }}>{data?.summary.totalModelCalls || 0}</div>
        </div>
      </div>

      {/* 模型使用统计 */}
      <h2 style={{ marginBottom: '16px', fontSize: '20px' }}>模型API使用统计</h2>
      <div style={{ marginBottom: '32px', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>优先级</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>模型名称</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>模型标识</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '14px', fontWeight: 600 }}>状态</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '14px', fontWeight: 600 }}>调用次数</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '14px', fontWeight: 600 }}>成功率</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', fontWeight: 600 }}>Token使用量</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>最后使用</th>
            </tr>
          </thead>
          <tbody>
            {data?.models && data.models.length > 0 ? (
              data.models.map((model) => (
                <tr key={model.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', background: '#e0e7ff', color: '#4338ca', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>#{model.order}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500 }}>{model.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280', fontFamily: 'monospace' }}>{model.model}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', background: model.enabled ? '#dcfce7' : '#fee2e2', color: model.enabled ? '#166534' : '#991b1b', borderRadius: '4px', fontSize: '12px' }}>
                      {model.enabled ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '14px' }}>{model.totalCalls}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{ color: model.successRate >= 90 ? '#16a34a' : model.successRate >= 70 ? '#d97706' : '#dc2626', fontWeight: 600 }}>
                      {model.successRate.toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', fontFamily: 'monospace' }}>{model.totalTokens.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>
                    {model.lastUsedAt ? new Date(model.lastUsedAt).toLocaleString('zh-CN') : '从未使用'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                  暂无模型配置，请先在"模型API管理"中添加
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 站点列表 */}
      <h2 style={{ marginBottom: '16px', fontSize: '20px' }}>站点详情</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {data?.sites.map((item) => (
          <div key={item.site.id} style={{ padding: '20px', border: '1px solid #e5e7eb', borderRadius: '12px', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px' }}>{item.site.name}</h3>
                <div style={{ fontSize: '13px', color: '#999', marginTop: '4px' }}>
                  {item.site.slug}
                  {item.site.enabled && (
                    <span style={{ marginLeft: '8px', padding: '2px 8px', background: '#dcfce7', color: '#166534', borderRadius: '4px', fontSize: '12px' }}>已启用</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {item.configs.length > 0 && (
                  <button onClick={() => handleGenerate(item.site.id, item.configs[0].id)} disabled={generatingSite === item.site.id}
                    style={{ padding: '8px 16px', background: generatingSite === item.site.id ? '#9ca3af' : '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: generatingSite === item.site.id ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                    {generatingSite === item.site.id ? '生成中...' : '生成一篇'}
                  </button>
                )}
                <button onClick={() => { setImportSiteId(importSiteId === item.site.id ? null : item.site.id); setExpandSiteId(null) }}
                  style={{ padding: '8px 16px', background: importSiteId === item.site.id ? '#16a34a' : '#fff', color: importSiteId === item.site.id ? '#fff' : '#16a34a', border: '1px solid #16a34a', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                  导入关键词
                </button>
                <button onClick={() => { setExpandSiteId(expandSiteId === item.site.id ? null : item.site.id); setImportSiteId(null) }}
                  style={{ padding: '8px 16px', background: expandSiteId === item.site.id ? '#9333ea' : '#fff', color: expandSiteId === item.site.id ? '#fff' : '#9333ea', border: '1px solid #9333ea', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                  AI扩词
                </button>
              </div>
            </div>

            {importSiteId === item.site.id && (
              <div style={{ marginTop: '16px', padding: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#166534' }}>批量导入关键词（每行一个）</div>
                <textarea value={importKeywords} onChange={(e) => setImportKeywords(e.target.value)} placeholder={"宠物美容\n宠物寄养\n宠物医疗\n宠物训练"}
                  style={{ width: '100%', minHeight: '100px', padding: '12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }} />
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleImportKeywords(item.site.id)} disabled={importLoading}
                    style={{ padding: '8px 20px', background: importLoading ? '#9ca3af' : '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: importLoading ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                    {importLoading ? '导入中...' : '确认导入'}
                  </button>
                  <button onClick={() => { setImportSiteId(null); setImportKeywords('') }}
                    style={{ padding: '8px 20px', background: '#fff', color: '#666', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                    取消
                  </button>
                </div>
              </div>
            )}

            {expandSiteId === item.site.id && (
              <div style={{ marginTop: '16px', padding: '16px', background: '#f3e8ff', borderRadius: '8px', border: '1px solid #d8b4fe' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#6b21a8' }}>AI智能扩词（围绕种子词生成长尾关键词）</div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input value={expandSeed} onChange={(e) => setExpandSeed(e.target.value)} placeholder="输入种子关键词，如：宠物美容"
                    style={{ flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px', color: '#666' }}>数量:</span>
                    <input type="number" value={expandCount} onChange={(e) => setExpandCount(Number(e.target.value))} min={5} max={30}
                      style={{ width: '60px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', textAlign: 'center' }} />
                  </div>
                  <button onClick={() => handleExpandKeywords(item.site.id)} disabled={expandLoading}
                    style={{ padding: '8px 20px', background: expandLoading ? '#9ca3af' : '#9333ea', color: '#fff', border: 'none', borderRadius: '6px', cursor: expandLoading ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                    {expandLoading ? '扩词中...' : '开始扩词'}
                  </button>
                  <button onClick={() => { setExpandSiteId(null); setExpandSeed('') }}
                    style={{ padding: '8px 20px', background: '#fff', color: '#666', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                    取消
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#999' }}>待使用关键词</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#16a34a' }}>{item.stats.pendingKeywords}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#999' }}>已使用关键词</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#6b7280' }}>{item.stats.usedKeywords}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#999' }}>文章总数</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#d97706' }}>{item.stats.totalArticles}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#999' }}>今日生成</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#9333ea' }}>{item.stats.todayGenerated}</div>
              </div>
            </div>

            {item.configs.length > 0 && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  生成配置：每天 {item.configs[0].dailyCount} 篇 · {item.configs[0].cronExpression}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {data?.sites.length === 0 && (
        <div style={{ padding: '60px', textAlign: 'center', color: '#999', border: '1px dashed #ddd', borderRadius: '12px' }}>
          暂无站点，请先在"站点管理"中添加站点
        </div>
      )}
    </div>
  )
}
