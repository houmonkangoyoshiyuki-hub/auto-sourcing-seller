import { useState, useEffect } from 'react'
import { ANTHROPIC_API_KEY, OPERATION_MODEL } from './config.js'

// ============================================================
// AutoSourcingSeller — Phase 1
// リサーチ → 提案 → 出品準備(確認画面 + ショップ連携)
// デザイン: Apple Human Interface 準拠(白 / #F5F5F7 / SF系フォント)
// ============================================================

const DEFAULT_SHOPS = [
  {
    id: 'base',
    name: 'BASE',
    url: 'https://masuyoshi726.base.shop',
    sellUrl: 'https://admin.thebase.com/shop_admin/items/add',
    color: '#00C8B4',
  },
  {
    id: 'mercari',
    name: 'メルカリ',
    url: 'https://jp.mercari.com/user/profile/473696101',
    sellUrl: 'https://jp.mercari.com/sell/create',
    color: '#FF0211',
  },
  {
    id: 'paypay',
    name: 'PayPayフリマ',
    url: 'https://paypayfleamarket.yahoo.co.jp/user/p47618785',
    sellUrl: 'https://paypayfleamarket.yahoo.co.jp/sell',
    color: '#FF0033',
  },
]

const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}
const save = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

const yen = (n) => '¥' + Number(n || 0).toLocaleString('ja-JP')

const RISK_STYLE = {
  '低': { bg: '#E8F8ED', fg: '#1B8A3A', label: 'リスク低' },
  '中': { bg: '#FFF4E0', fg: '#B26A00', label: 'リスク中' },
  '高': { bg: '#FFE9E7', fg: '#C42B1C', label: 'リスク高' },
}

// ---------- Claude API 呼び出し(運用 = Sonnet / コスト最適化) ----------
async function callClaude(messages, { useSearch = false, maxTokens = 4000 } = {}) {
  const body = {
    model: OPERATION_MODEL,
    max_tokens: maxTokens,
    messages,
  }
  if (useSearch) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search' }]
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error('APIエラー (' + res.status + '): ' + t.slice(0, 200))
  }
  const data = await res.json()
  return data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
}

function parseJsonLoose(text) {
  let t = text.replace(/```json/g, '').replace(/```/g, '').trim()
  const start = Math.min(
    ...['[', '{'].map((c) => {
      const i = t.indexOf(c)
      return i === -1 ? Infinity : i
    })
  )
  if (start !== Infinity) t = t.slice(start)
  const end = Math.max(t.lastIndexOf(']'), t.lastIndexOf('}'))
  if (end !== -1) t = t.slice(0, end + 1)
  return JSON.parse(t)
}

// ============================================================
// メイン
// ============================================================
export default function App() {
  const [tab, setTab] = useState('research')
  const [shops, setShops] = useState(() => load('ass_shops', DEFAULT_SHOPS))
  const [listings, setListings] = useState(() => load('ass_listings', []))
  const [minProfitDefault, setMinProfitDefault] = useState(() => load('ass_minprofit', 1000))
  const [prepTarget, setPrepTarget] = useState(null) // リサーチ→出品準備への受け渡し
  const [toast, setToast] = useState('')

  useEffect(() => save('ass_shops', shops), [shops])
  useEffect(() => save('ass_listings', listings), [listings])
  useEffect(() => save('ass_minprofit', minProfitDefault), [minProfitDefault])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  const goPrepare = (proposal) => {
    setPrepTarget(proposal)
    setTab('prepare')
  }

  return (
    <div style={S.app}>
      <style>{GLOBAL_CSS}</style>

      <header style={S.header}>
        <div style={S.headerInner}>
          <div>
            <div style={S.brand}>AutoSourcingSeller</div>
            <div style={S.brandSub}>リサーチから出品まで、3タップで。</div>
          </div>
          <div style={S.modelChip}>運用: Sonnet(低コスト)</div>
        </div>
      </header>

      <main style={S.main}>
        {tab === 'research' && (
          <ResearchTab
            minProfitDefault={minProfitDefault}
            onPrepare={goPrepare}
            showToast={showToast}
          />
        )}
        {tab === 'prepare' && (
          <PrepareTab
            prepTarget={prepTarget}
            clearTarget={() => setPrepTarget(null)}
            shops={shops}
            listings={listings}
            setListings={setListings}
            showToast={showToast}
          />
        )}
        {tab === 'dashboard' && <DashboardTab listings={listings} showToast={showToast} />}
        {tab === 'settings' && (
          <SettingsTab
            shops={shops}
            setShops={setShops}
            minProfitDefault={minProfitDefault}
            setMinProfitDefault={setMinProfitDefault}
            showToast={showToast}
          />
        )}
      </main>

      {toast && <div style={S.toast}>{toast}</div>}

      <nav style={S.tabbar}>
        {[
          ['research', '🔍', 'リサーチ'],
          ['prepare', '📦', '出品準備'],
          ['dashboard', '📊', 'ダッシュボード'],
          ['settings', '⚙️', '設定'],
        ].map(([id, icon, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{ ...S.tabBtn, color: tab === id ? '#0071E3' : '#8E8E93' }}
          >
            <span style={{ fontSize: 22 }}>{icon}</span>
            <span style={{ fontSize: 10, fontWeight: tab === id ? 600 : 400 }}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

// ============================================================
// ① リサーチ & 提案
// ============================================================
function ResearchTab({ minProfitDefault, onPrepare, showToast }) {
  const [keyword, setKeyword] = useState('')
  const [mode, setMode] = useState('both') // both | stockless | stocked
  const [minProfit, setMinProfit] = useState(minProfitDefault)
  const [loading, setLoading] = useState(false)
  const [proposals, setProposals] = useState(() => load('ass_proposals', []))
  const [error, setError] = useState('')

  useEffect(() => save('ass_proposals', proposals), [proposals])

  const runResearch = async () => {
    if (!keyword.trim()) {
      showToast('キーワードかコンセプトを入れてください')
      return
    }
    if (!ANTHROPIC_API_KEY) {
      setError('APIキーが未設定です。Vercelの環境変数 VITE_ANTHROPIC_API_KEY を設定してください。')
      return
    }
    setLoading(true)
    setError('')
    try {
      const modeText =
        mode === 'stockless'
          ? '無在庫(受注後に仕入れ)モードのみ'
          : mode === 'stocked'
          ? '在庫あり(先に仕入れ)モードのみ'
          : '無在庫モードと在庫ありモードの両方をバランスよく'

      const prompt = `あなたは日本のフリマ・ネットショップ物販のプロです。web検索で現在の相場を調べた上で、初心者(主婦)が成功体験を積みやすい商品を提案してください。

条件:
- キーワード/コンセプト: ${keyword}
- モード: ${modeText}
- 1商品あたりの最低利益: ${minProfit}円以上
- 販路: メルカリ / PayPayフリマ / BASE
- リスク低め・回転が速い・扱いやすい(小さい/軽い/壊れにくい)商品を優先
- 仕入れ先は具体的に(例: Amazon, アリエクスプレス, 卸サイト名, 実店舗名)

必ず次のJSON配列のみで回答してください(前置き・説明文・コードブロック記号は一切不要):
[
  {
    "name": "商品名",
    "mode": "無在庫" または "在庫あり",
    "source": "仕入れ先",
    "cost": 仕入れ値の数値,
    "price": 想定売価の数値,
    "fee": 手数料+送料の概算数値,
    "profit": 利益の数値,
    "margin": 利益率の数値(%),
    "monthly": "予想売上の目安(例: 月3〜5個 / 9000〜15000円)",
    "risk": "低" または "中" または "高",
    "reason": "この商品を勧める理由と注意点(2文以内)"
  }
]
5〜6商品提案してください。利益${minProfit}円未満の商品は含めないでください。`

      const text = await callClaude([{ role: 'user', content: prompt }], {
        useSearch: true,
        maxTokens: 4000,
      })
      const arr = parseJsonLoose(text)
      const stamped = arr.map((p, i) => ({
        ...p,
        id: Date.now() + '_' + i,
        keyword,
        createdAt: new Date().toISOString(),
      }))
      setProposals(stamped)
      showToast(stamped.length + '件の提案が届きました')
    } catch (e) {
      setError('リサーチに失敗しました: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <SectionTitle title="市場リサーチ" sub="キーワードかコンセプトを入れて、利益の出る商品をAIが探します" />

      <div style={S.card}>
        <label style={S.label}>キーワード / コンセプト</label>
        <input
          style={S.input}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="例: 韓国コスメ / 北欧インテリア / 子育て便利グッズ"
        />

        <label style={{ ...S.label, marginTop: 16 }}>モード</label>
        <div style={S.segment}>
          {[
            ['both', '両方'],
            ['stockless', '無在庫'],
            ['stocked', '在庫あり'],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setMode(v)}
              style={{
                ...S.segmentBtn,
                background: mode === v ? '#FFFFFF' : 'transparent',
                boxShadow: mode === v ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                fontWeight: mode === v ? 600 : 400,
              }}
            >
              {l}
            </button>
          ))}
        </div>

        <label style={{ ...S.label, marginTop: 16 }}>1商品の最低利益(円)</label>
        <input
          style={S.input}
          type="number"
          inputMode="numeric"
          value={minProfit}
          onChange={(e) => setMinProfit(Number(e.target.value))}
        />

        <button style={{ ...S.primaryBtn, marginTop: 20 }} onClick={runResearch} disabled={loading}>
          {loading ? 'リサーチ中…(30秒ほどかかります)' : 'リサーチ開始'}
        </button>
        {error && <div style={S.errorBox}>{error}</div>}
      </div>

      {proposals.length > 0 && (
        <>
          <SectionTitle title="提案" sub={'「' + (proposals[0].keyword || '') + '」の結果 — 気に入った商品を選んでください'} />
          {proposals.map((p) => (
            <ProposalCard key={p.id} p={p} onPrepare={() => onPrepare(p)} />
          ))}
        </>
      )}

      {!loading && proposals.length === 0 && (
        <div style={S.empty}>
          まだ提案はありません。<br />
          上の欄にキーワードを入れて「リサーチ開始」を押してください。
        </div>
      )}
    </div>
  )
}

function ProposalCard({ p, onPrepare }) {
  const risk = RISK_STYLE[p.risk] || RISK_STYLE['中']
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.35 }}>{p.name}</div>
        <span style={{ ...S.badge, background: risk.bg, color: risk.fg }}>{risk.label}</span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ ...S.badge, background: '#EEF4FF', color: '#0055B0' }}>{p.mode}</span>
        <span style={{ ...S.badge, background: '#F2F2F7', color: '#3A3A3C' }}>仕入れ: {p.source}</span>
      </div>

      <div style={S.profitRow}>
        <div>
          <div style={S.profitLabel}>見込み利益</div>
          <div style={S.profitBig}>{yen(p.profit)}</div>
        </div>
        <div style={S.profitMeta}>
          <div>売価 {yen(p.price)} − 仕入 {yen(p.cost)} − 手数料等 {yen(p.fee)}</div>
          <div>利益率 {p.margin}% ・ {p.monthly}</div>
        </div>
      </div>

      <div style={S.reason}>{p.reason}</div>

      <button style={{ ...S.primaryBtn, marginTop: 14 }} onClick={onPrepare}>
        この商品で出品準備 →
      </button>
    </div>
  )
}

// ============================================================
// ② 出品準備(文面生成 → 確認画面 → ショップ連携)
// ============================================================
function PrepareTab({ prepTarget, clearTarget, shops, listings, setListings, showToast }) {
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (prepTarget) generateDraft(prepTarget)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepTarget])

  const generateDraft = async (p) => {
    setLoading(true)
    setError('')
    try {
      const prompt = `日本のフリマアプリ用の出品文面を作成してください。

商品: ${p.name}
仕入れ先: ${p.source} / 仕入れ値: ${p.cost}円 / 想定売価: ${p.price}円 / モード: ${p.mode}
補足: ${p.reason}

必ず次のJSONのみで回答(コードブロック記号不要):
{
  "title": "メルカリ用タイトル(40文字以内・検索されやすいキーワードを前方に)",
  "description": "説明文(300〜400字。冒頭に一言挨拶、商品の特徴、サイズや状態、発送目安、ハッシュタグ3〜5個を最後に)",
  "price": 出品価格の数値,
  "tags": ["タグ1", "タグ2", "タグ3", "タグ4", "タグ5"],
  "photoTips": "撮影のコツ(1〜2文。自然光・角度・背景など具体的に)"
}`
      const text = await callClaude([{ role: 'user', content: prompt }], { maxTokens: 1500 })
      const d = parseJsonLoose(text)
      setDraft({ ...d, proposal: p })
    } catch (e) {
      setError('文面の生成に失敗しました: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const confirmListing = () => {
    const item = {
      id: 'L' + Date.now(),
      name: draft.proposal.name,
      title: draft.title,
      description: draft.description,
      price: Number(draft.price),
      cost: Number(draft.proposal.cost),
      fee: Number(draft.proposal.fee),
      tags: draft.tags,
      mode: draft.proposal.mode,
      status: '出品中',
      shopsPosted: [],
      createdAt: new Date().toISOString(),
      soldAt: null,
    }
    setListings([item, ...listings])
    setDraft(null)
    clearTarget()
    showToast('出品リストに登録しました')
  }

  const markSold = (id) => {
    setListings(
      listings.map((l) =>
        l.id === id ? { ...l, status: '売却済み', soldAt: new Date().toISOString() } : l
      )
    )
    showToast('おめでとうございます!🎉 他ショップの取り下げを忘れずに')
  }

  const removeListing = (id) => {
    setListings(listings.filter((l) => l.id !== id))
    showToast('削除しました')
  }

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(label + 'をコピーしました')
    } catch {
      showToast('コピーできませんでした。長押しで選択してください')
    }
  }

  // ----- 確認画面 -----
  if (loading) {
    return (
      <div style={S.empty}>
        <div style={{ fontSize: 34, marginBottom: 12 }}>✍️</div>
        出品文面を作成しています…<br />そのままお待ちください。
      </div>
    )
  }

  if (draft) {
    return (
      <div>
        <SectionTitle title="出品前の確認" sub="内容はすべてタップして直せます。よければ一番下のOKを押してください" />

        <div style={S.card}>
          <label style={S.label}>タイトル({draft.title.length}文字)</label>
          <input
            style={S.input}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />

          <label style={{ ...S.label, marginTop: 16 }}>説明文</label>
          <textarea
            style={{ ...S.input, minHeight: 200, lineHeight: 1.6, resize: 'vertical' }}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />

          <label style={{ ...S.label, marginTop: 16 }}>価格(円)</label>
          <input
            style={S.input}
            type="number"
            inputMode="numeric"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
          />

          <label style={{ ...S.label, marginTop: 16 }}>タグ</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {draft.tags.map((t, i) => (
              <span key={i} style={{ ...S.badge, background: '#EEF4FF', color: '#0055B0' }}>
                #{t}
              </span>
            ))}
          </div>

          <div style={S.tipBox}>📷 {draft.photoTips}</div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button
              style={{ ...S.secondaryBtn, flex: 1 }}
              onClick={() => {
                setDraft(null)
                clearTarget()
              }}
            >
              やめる
            </button>
            <button style={{ ...S.primaryBtn, flex: 2 }} onClick={confirmListing}>
              OK — 出品リストへ
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ----- 出品リスト -----
  const active = listings.filter((l) => l.status === '出品中')
  const sold = listings.filter((l) => l.status === '売却済み')

  return (
    <div>
      <SectionTitle
        title="出品リスト"
        sub="コピーボタンで文面を写して、各ショップの出品ページに貼るだけ(約30秒)"
      />
      {error && <div style={S.errorBox}>{error}</div>}

      {listings.length === 0 && (
        <div style={S.empty}>
          まだ出品はありません。<br />
          「リサーチ」タブで商品を選ぶと、ここに出品準備が並びます。
        </div>
      )}

      {active.map((l) => (
        <div key={l.id} style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35 }}>{l.title}</div>
            <span style={{ ...S.badge, background: '#E8F8ED', color: '#1B8A3A', whiteSpace: 'nowrap' }}>
              出品中
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#6E6E73', marginTop: 4 }}>
            {yen(l.price)} ・ 見込み利益 {yen(l.price - l.cost - l.fee)} ・ {l.mode}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button style={S.miniBtn} onClick={() => copy(l.title, 'タイトル')}>タイトルをコピー</button>
            <button style={S.miniBtn} onClick={() => copy(l.description, '説明文')}>説明文をコピー</button>
            <button style={S.miniBtn} onClick={() => copy(l.tags.map((t) => '#' + t).join(' '), 'タグ')}>
              タグをコピー
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: '#8E8E93', marginBottom: 6 }}>出品ページを開く:</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {shops.map((s) => (
                <a key={s.id} href={s.sellUrl} target="_blank" rel="noreferrer" style={{ ...S.shopBtn, borderColor: s.color, color: s.color }}>
                  {s.name} ↗
                </a>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button style={{ ...S.secondaryBtn, flex: 1 }} onClick={() => removeListing(l.id)}>
              削除
            </button>
            <button
              style={{ ...S.primaryBtn, flex: 2, background: '#34C759' }}
              onClick={() => markSold(l.id)}
            >
              売れた!🎉
            </button>
          </div>
        </div>
      ))}

      {sold.length > 0 && (
        <>
          <SectionTitle title="売却済み" sub="売れたら、他のショップの同じ商品を必ず取り下げてください" />
          {sold.map((l) => (
            <div key={l.id} style={{ ...S.card, opacity: 0.92 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{l.title}</div>
                <span style={{ ...S.badge, background: '#F2F2F7', color: '#3A3A3C', whiteSpace: 'nowrap' }}>
                  売却済み
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#6E6E73', marginTop: 4 }}>
                売上 {yen(l.price)} ・ 利益 {yen(l.price - l.cost - l.fee)}
              </div>
              <div style={S.warnBox}>
                ⚠️ 取り下げチェック — 他ショップに同じ商品が残っていたら削除:
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {shops.map((s) => (
                    <a key={s.id} href={s.url} target="_blank" rel="noreferrer" style={{ ...S.shopBtn, borderColor: '#B26A00', color: '#B26A00' }}>
                      {s.name}を確認 ↗
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ============================================================
// ③ ダッシュボード + 週次レポート
// ============================================================
function DashboardTab({ listings, showToast }) {
  const sold = listings.filter((l) => l.status === '売却済み')
  const active = listings.filter((l) => l.status === '出品中')
  const sales = sold.reduce((a, l) => a + l.price, 0)
  const profit = sold.reduce((a, l) => a + (l.price - l.cost - l.fee), 0)

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const soldThisWeek = sold.filter((l) => new Date(l.soldAt).getTime() >= weekAgo)
  const weekSales = soldThisWeek.reduce((a, l) => a + l.price, 0)
  const weekProfit = soldThisWeek.reduce((a, l) => a + (l.price - l.cost - l.fee), 0)

  const goal = 300000
  const pct = Math.min(100, Math.round((weekProfit * 4.3 / goal) * 100))

  const weeklyReport = () => {
    const lines = [
      '📊 週次レポート(' + new Date().toLocaleDateString('ja-JP') + ')',
      '━━━━━━━━━━━━',
      '今週の売上: ' + yen(weekSales),
      '今週の利益: ' + yen(weekProfit),
      '売れた数: ' + soldThisWeek.length + '件',
      '出品中: ' + active.length + '件',
      '━━━━━━━━━━━━',
      '累計売上: ' + yen(sales),
      '累計利益: ' + yen(profit),
      '月収30万ペースまで: ' + pct + '%',
      '',
      ...soldThisWeek.map((l) => '・' + l.title + ' → 利益 ' + yen(l.price - l.cost - l.fee)),
    ]
    navigator.clipboard
      .writeText(lines.join('\n'))
      .then(() => showToast('レポートをコピーしました'))
      .catch(() => showToast('コピーできませんでした'))
  }

  return (
    <div>
      <SectionTitle title="ダッシュボード" sub="数字は「売れた!」ボタンを押すと自動で集計されます" />

      <div style={S.statGrid}>
        <StatCard label="累計利益" value={yen(profit)} big accent="#1B8A3A" />
        <StatCard label="累計売上" value={yen(sales)} />
        <StatCard label="出品中" value={active.length + '件'} />
        <StatCard label="売れた数" value={sold.length + '件'} />
      </div>

      <div style={S.card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6E73' }}>今週(直近7日)</div>
        <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
          <div>
            <div style={S.profitLabel}>利益</div>
            <div style={{ ...S.profitBig, fontSize: 24 }}>{yen(weekProfit)}</div>
          </div>
          <div>
            <div style={S.profitLabel}>売上</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{yen(weekSales)}</div>
          </div>
          <div>
            <div style={S.profitLabel}>件数</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{soldThisWeek.length}</div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6E6E73' }}>
            <span>月収30万円ペース</span>
            <span>{pct}%</span>
          </div>
          <div style={S.progressTrack}>
            <div style={{ ...S.progressFill, width: pct + '%' }} />
          </div>
        </div>

        <button style={{ ...S.secondaryBtn, marginTop: 16, width: '100%' }} onClick={weeklyReport}>
          週次レポートをコピー(LINEやメモに貼れます)
        </button>
      </div>
    </div>
  )
}

function StatCard({ label, value, big, accent }) {
  return (
    <div style={S.statCard}>
      <div style={{ fontSize: 12, color: '#6E6E73' }}>{label}</div>
      <div style={{ fontSize: big ? 26 : 20, fontWeight: 700, color: accent || '#1D1D1F', marginTop: 4 }}>
        {value}
      </div>
    </div>
  )
}

// ============================================================
// ④ 設定(ショップ管理・デフォルト値)
// ============================================================
function SettingsTab({ shops, setShops, minProfitDefault, setMinProfitDefault, showToast }) {
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newSellUrl, setNewSellUrl] = useState('')

  const addShop = () => {
    if (!newName.trim() || !newUrl.trim()) {
      showToast('ショップ名とURLを入れてください')
      return
    }
    setShops([
      ...shops,
      {
        id: 's' + Date.now(),
        name: newName.trim(),
        url: newUrl.trim(),
        sellUrl: newSellUrl.trim() || newUrl.trim(),
        color: '#0071E3',
      },
    ])
    setNewName('')
    setNewUrl('')
    setNewSellUrl('')
    showToast('ショップを追加しました')
  }

  const removeShop = (id) => {
    setShops(shops.filter((s) => s.id !== id))
    showToast('削除しました')
  }

  return (
    <div>
      <SectionTitle title="ショップ" sub="出品先のショップを管理します" />

      {shops.map((s) => (
        <div key={s.id} style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{s.name}</div>
            <div style={{ fontSize: 12, color: '#8E8E93', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.url}
            </div>
          </div>
          <button style={{ ...S.miniBtn, color: '#C42B1C' }} onClick={() => removeShop(s.id)}>
            削除
          </button>
        </div>
      ))}

      <div style={S.card}>
        <label style={S.label}>ショップを追加</label>
        <input style={S.input} placeholder="ショップ名(例: ラクマ)" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <input style={{ ...S.input, marginTop: 8 }} placeholder="マイページURL" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
        <input style={{ ...S.input, marginTop: 8 }} placeholder="出品ページURL(任意)" value={newSellUrl} onChange={(e) => setNewSellUrl(e.target.value)} />
        <button style={{ ...S.primaryBtn, marginTop: 12 }} onClick={addShop}>追加する</button>
      </div>

      <SectionTitle title="リサーチの設定" sub="" />
      <div style={S.card}>
        <label style={S.label}>最低利益のデフォルト(円)</label>
        <input
          style={S.input}
          type="number"
          inputMode="numeric"
          value={minProfitDefault}
          onChange={(e) => setMinProfitDefault(Number(e.target.value))}
        />
      </div>

      <div style={S.card}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>システム情報</div>
        <div style={{ fontSize: 13, color: '#6E6E73', marginTop: 8, lineHeight: 1.7 }}>
          APIキー: {ANTHROPIC_API_KEY ? '✅ 設定済み' : '❌ 未設定(Vercelの環境変数 VITE_ANTHROPIC_API_KEY)'}
          <br />
          運用モデル: {OPERATION_MODEL}(低コスト)
          <br />
          設計・大規模修正: Fable 5(チャットで実施)
          <br />
          自動出品Botは各フリマの規約違反(アカウント凍結リスク)のため、
          本アプリは「コピー→貼るだけ」の安全設計です。BASEのみ公式APIでの自動化をPhase 2で予定。
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 共通パーツ / スタイル
// ============================================================
function SectionTitle({ title, sub }) {
  return (
    <div style={{ margin: '22px 4px 10px' }}>
      <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: '#6E6E73', marginTop: 3, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  )
}

const GLOBAL_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  html, body { background: #F5F5F7; }
  body { font-family: -apple-system, BlinkMacSystemFont, "SF Pro JP", "SF Pro Text", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif; color: #1D1D1F; -webkit-font-smoothing: antialiased; }
  input, textarea, button { font-family: inherit; }
  button { cursor: pointer; border: none; }
  a { text-decoration: none; }
  input:focus, textarea:focus { outline: 2px solid #0071E3; outline-offset: 0; border-color: transparent; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`

const S = {
  app: { maxWidth: 560, margin: '0 auto', padding: '0 16px 100px', minHeight: '100vh' },
  header: { padding: '18px 4px 4px' },
  headerInner: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' },
  brandSub: { fontSize: 13, color: '#6E6E73', marginTop: 2 },
  modelChip: {
    fontSize: 11, color: '#0055B0', background: '#EEF4FF', padding: '4px 10px',
    borderRadius: 100, fontWeight: 600, whiteSpace: 'nowrap', marginTop: 4,
  },
  main: {},
  card: {
    background: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#3A3A3C', marginBottom: 6 },
  input: {
    width: '100%', fontSize: 16, padding: '12px 14px', borderRadius: 12,
    border: '1px solid #E5E5EA', background: '#FAFAFA', color: '#1D1D1F',
  },
  segment: { display: 'flex', background: '#E9E9EB', borderRadius: 10, padding: 3 },
  segmentBtn: { flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 14, color: '#1D1D1F', transition: 'all .15s' },
  primaryBtn: {
    width: '100%', background: '#0071E3', color: '#FFF', fontSize: 16, fontWeight: 600,
    padding: '14px 0', borderRadius: 14,
  },
  secondaryBtn: {
    background: '#F2F2F7', color: '#1D1D1F', fontSize: 15, fontWeight: 600,
    padding: '13px 0', borderRadius: 14,
  },
  miniBtn: {
    background: '#F2F2F7', color: '#0071E3', fontSize: 13, fontWeight: 600,
    padding: '8px 12px', borderRadius: 10,
  },
  shopBtn: {
    fontSize: 13, fontWeight: 600, padding: '8px 12px', borderRadius: 10,
    border: '1.5px solid', background: '#FFF',
  },
  badge: { fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 100, whiteSpace: 'nowrap' },
  profitRow: {
    display: 'flex', alignItems: 'flex-end', gap: 14, marginTop: 14,
    padding: '12px 14px', background: '#F7FCF8', borderRadius: 12,
  },
  profitLabel: { fontSize: 11, color: '#6E6E73', fontWeight: 600 },
  profitBig: { fontSize: 28, fontWeight: 800, color: '#1B8A3A', letterSpacing: '-0.02em', lineHeight: 1.1 },
  profitMeta: { fontSize: 12, color: '#6E6E73', lineHeight: 1.6, paddingBottom: 2 },
  reason: { fontSize: 13, color: '#3A3A3C', marginTop: 10, lineHeight: 1.6 },
  tipBox: {
    marginTop: 14, fontSize: 13, color: '#0055B0', background: '#EEF4FF',
    padding: '10px 12px', borderRadius: 12, lineHeight: 1.6,
  },
  warnBox: {
    marginTop: 10, fontSize: 13, color: '#B26A00', background: '#FFF4E0',
    padding: '10px 12px', borderRadius: 12, lineHeight: 1.6,
  },
  errorBox: {
    marginTop: 12, fontSize: 13, color: '#C42B1C', background: '#FFE9E7',
    padding: '10px 12px', borderRadius: 12, lineHeight: 1.6, wordBreak: 'break-all',
  },
  empty: {
    textAlign: 'center', color: '#8E8E93', fontSize: 14, lineHeight: 1.8,
    padding: '48px 16px', background: '#FFFFFF', borderRadius: 18, marginTop: 16,
  },
  statGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 },
  statCard: { background: '#FFFFFF', borderRadius: 16, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  progressTrack: { height: 8, background: '#E9E9EB', borderRadius: 100, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg,#34C759,#1B8A3A)', borderRadius: 100, transition: 'width .4s' },
  toast: {
    position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(29,29,31,0.92)', color: '#FFF', fontSize: 13, fontWeight: 600,
    padding: '10px 18px', borderRadius: 100, zIndex: 100, whiteSpace: 'nowrap',
    backdropFilter: 'blur(10px)',
  },
  tabbar: {
    position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex',
    background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(20px)',
    borderTop: '0.5px solid rgba(0,0,0,0.12)', paddingBottom: 'env(safe-area-inset-bottom)',
    zIndex: 50,
  },
  tabBtn: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    padding: '8px 0 6px', background: 'transparent',
  },
}
