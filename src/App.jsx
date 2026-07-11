import { useState, useEffect, useRef } from 'react'
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
- 可能な限り、実際に購入できる商品ページの具体的なURLをsourceUrlに入れてください(わからない場合は仕入れ先サイトのトップページURL)
- 重要: メルカリ・PayPayフリマは「実際に所持していない商品」の出品を規約で禁止しています。「無在庫」提案でも、実際には先に1個だけ仕入れてから出品する前提で提案してください

必ず次のJSON配列のみで回答してください(前置き・説明文・コードブロック記号は一切不要):
[
  {
    "name": "商品名",
    "mode": "無在庫" または "在庫あり",
    "source": "仕入れ先",
    "sourceUrl": "仕入れ先の商品ページURL",
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

      {p.sourceUrl && (
        <a href={p.sourceUrl} target="_blank" rel="noreferrer" style={S.sourceLink}>
          仕入れ先ページを見る ↗
        </a>
      )}

      {p.mode === '無在庫' && (
        <div style={S.warnBox}>
          ⚠️ 規約上、商品を持たずに出品するのはNGです。まず上のリンクから1個だけ仕入れてから出品してください。
        </div>
      )}

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
      setDraft({ ...d, sourceUrl: p.sourceUrl || '', images: [], proposal: p })
    } catch (e) {
      setError('文面の生成に失敗しました: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const confirmListing = () => {
    const mode = draft.proposal.mode
    const item = {
      id: 'L' + Date.now(),
      name: draft.proposal.name,
      title: draft.title,
      description: draft.description,
      price: Number(draft.price),
      cost: Number(draft.proposal.cost),
      fee: Number(draft.proposal.fee),
      tags: draft.tags,
      mode,
      sourceUrl: draft.sourceUrl || '',
      images: draft.images || [],
      status: '出品中',
      // 在庫あり: 既に手元にあるので purchased/arrived は完了扱い
      checklist:
        mode === '在庫あり'
          ? { purchased: true, arrived: true, packed: false, shipped: false }
          : { purchased: false, arrived: false, packed: false, shipped: false },
      trackingNo: '',
      lastStockCheck: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      soldAt: null,
      shippedAt: null,
    }
    setListings([item, ...listings])
    setDraft(null)
    clearTarget()
    showToast('出品リストに登録しました')
  }

  // 「売れた」→ 対応中(チェックリスト)へ
  const markSold = (id) => {
    setListings(
      listings.map((l) => (l.id === id ? { ...l, status: '対応中', soldAt: new Date().toISOString() } : l))
    )
    showToast('おめでとうございます!🎉 発送までのチェックリストを進めてください')
  }

  // 対応中 → 出品中に戻す(押し間違い対応)
  const undoSold = (id) => {
    setListings(
      listings.map((l) =>
        l.id === id
          ? {
              ...l,
              status: '出品中',
              soldAt: null,
              checklist:
                l.mode === '在庫あり'
                  ? { purchased: true, arrived: true, packed: false, shipped: false }
                  : { purchased: false, arrived: false, packed: false, shipped: false },
            }
          : l
      )
    )
    showToast('出品中に戻しました')
  }

  // 完了 → 対応中に戻す(返品などの訂正用)
  const undoComplete = (id) => {
    setListings(
      listings.map((l) => (l.id === id ? { ...l, status: '対応中', shippedAt: null } : l))
    )
    showToast('対応中に戻しました')
  }

  const toggleChecklist = (id, key) => {
    setListings(
      listings.map((l) =>
        l.id === id ? { ...l, checklist: { ...l.checklist, [key]: !l.checklist[key] } } : l
      )
    )
  }

  const setTrackingNo = (id, val) => {
    setListings(listings.map((l) => (l.id === id ? { ...l, trackingNo: val } : l)))
  }

  const completeShipping = (id) => {
    setListings(
      listings.map((l) =>
        l.id === id ? { ...l, status: '完了', shippedAt: new Date().toISOString() } : l
      )
    )
    showToast('発送完了!お疲れさまでした🎉')
  }

  const markStockChecked = (id, url) => {
    if (url) window.open(url, '_blank', 'noopener')
    setListings(
      listings.map((l) => (l.id === id ? { ...l, lastStockCheck: new Date().toISOString() } : l))
    )
    showToast('確認日を更新しました')
  }

  const markOutOfStock = (id) => {
    setListings(listings.map((l) => (l.id === id ? { ...l, status: '出品停止' } : l)))
    showToast('出品を停止しました。ショップ側でも取り下げてください')
  }

  const removeListing = (id) => {
    setListings(listings.filter((l) => l.id !== id))
    showToast('削除しました')
  }

  const addListingImage = (id, src) => {
    setListings(listings.map((l) => (l.id === id ? { ...l, images: [...(l.images || []), src] } : l)))
  }

  const removeListingImage = (id, i) => {
    setListings(
      listings.map((l) => (l.id === id ? { ...l, images: (l.images || []).filter((_, idx) => idx !== i) } : l))
    )
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

          <div style={{ marginTop: 16 }}>
            <ImageGallery
              images={draft.images || []}
              onAdd={(src) => setDraft({ ...draft, images: [...(draft.images || []), src] })}
              onRemove={(i) => setDraft({ ...draft, images: draft.images.filter((_, idx) => idx !== i) })}
            />
          </div>

          <div style={S.tipBox}>📷 {draft.photoTips}</div>
          <div style={S.warnBox}>
            ⚠️ 出品写真は必ずご自身で撮影したものを使ってください。仕入れ先の写真をそのまま転載すると規約違反になることがあります。
          </div>

          {draft.sourceUrl && (
            <a href={draft.sourceUrl} target="_blank" rel="noreferrer" style={{ ...S.sourceLink, marginTop: 12 }}>
              仕入れ先ページを開く(商品購入・参考写真の確認) ↗
            </a>
          )}

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
  const inProgress = listings.filter((l) => l.status === '対応中')
  const done = listings.filter((l) => l.status === '完了')
  const stopped = listings.filter((l) => l.status === '出品停止')

  const daysSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)

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

      {active.map((l) => {
        const needStockCheck = l.mode === '無在庫' && daysSince(l.lastStockCheck || l.createdAt) >= 3
        return (
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

            {needStockCheck && (
              <div style={S.nudgeBox}>
                🔔 仕入れ先の在庫、そろそろ確認しましょう(前回確認から{daysSince(l.lastStockCheck || l.createdAt)}日)
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button style={{ ...S.miniBtn, background: '#FFF' }} onClick={() => markStockChecked(l.id, l.sourceUrl)}>
                    見てきた(確認済みにする)
                  </button>
                  <button style={{ ...S.miniBtn, color: '#C42B1C', background: '#FFF' }} onClick={() => markOutOfStock(l.id)}>
                    在庫切れだった
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button style={S.miniBtn} onClick={() => copy(l.title, 'タイトル')}>タイトルをコピー</button>
              <button style={S.miniBtn} onClick={() => copy(l.description, '説明文')}>説明文をコピー</button>
              <button style={S.miniBtn} onClick={() => copy(l.tags.map((t) => '#' + t).join(' '), 'タグ')}>
                タグをコピー
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <ImageGallery
                images={l.images || []}
                onAdd={(src) => addListingImage(l.id, src)}
                onRemove={(i) => removeListingImage(l.id, i)}
              />
            </div>

            {l.sourceUrl && (
              <a href={l.sourceUrl} target="_blank" rel="noreferrer" style={{ ...S.sourceLink, marginTop: 10 }}>
                仕入れ先ページ ↗
              </a>
            )}

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
        )
      })}

      {inProgress.length > 0 && (
        <>
          <SectionTitle title="対応中" sub="発送までのチェックリストです。押し間違えたらいつでも「出品中に戻す」でOK" />
          {inProgress.map((l) => {
            const steps =
              l.mode === '無在庫'
                ? [
                    { key: 'purchased', label: '仕入れ先で商品を購入した' },
                    { key: 'arrived', label: '商品が到着した' },
                    { key: 'packed', label: '検品して梱包した' },
                    { key: 'shipped', label: '発送した' },
                  ]
                : [
                    { key: 'packed', label: '梱包した' },
                    { key: 'shipped', label: '発送した' },
                  ]
            const allDone = steps.every((s) => l.checklist[s.key])
            return (
              <div key={l.id} style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{l.title}</div>
                  <span style={{ ...S.badge, background: '#FFF4E0', color: '#B26A00', whiteSpace: 'nowrap' }}>
                    対応中
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#6E6E73', marginTop: 4 }}>
                  売上 {yen(l.price)} ・ 利益 {yen(l.price - l.cost - l.fee)}
                </div>

                {l.sourceUrl && l.mode === '無在庫' && !l.checklist.purchased && (
                  <a href={l.sourceUrl} target="_blank" rel="noreferrer" style={{ ...S.sourceLink, marginTop: 10 }}>
                    仕入れ先で購入する ↗
                  </a>
                )}

                <div style={{ marginTop: 12 }}>
                  {steps.map((s) => (
                    <label key={s.key} style={S.checkRow}>
                      <input
                        type="checkbox"
                        checked={!!l.checklist[s.key]}
                        onChange={() => toggleChecklist(l.id, s.key)}
                        style={S.checkbox}
                      />
                      <span style={{ textDecoration: l.checklist[s.key] ? 'line-through' : 'none', color: l.checklist[s.key] ? '#8E8E93' : '#1D1D1F' }}>
                        {s.label}
                      </span>
                    </label>
                  ))}
                </div>

                {l.checklist.packed && (
                  <div style={{ marginTop: 10 }}>
                    <label style={S.label}>追跡番号(任意)</label>
                    <input
                      style={S.input}
                      value={l.trackingNo}
                      onChange={(e) => setTrackingNo(l.id, e.target.value)}
                      placeholder="配送業者の追跡番号"
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button style={{ ...S.secondaryBtn, flex: 1 }} onClick={() => undoSold(l.id)}>
                    出品中に戻す
                  </button>
                  <button
                    style={{ ...S.primaryBtn, flex: 2, opacity: allDone ? 1 : 0.4 }}
                    disabled={!allDone}
                    onClick={() => completeShipping(l.id)}
                  >
                    発送完了にする
                  </button>
                </div>
              </div>
            )
          })}
        </>
      )}

      {done.length > 0 && (
        <>
          <SectionTitle title="完了" sub="発送済みの商品です。他ショップの取り下げも忘れずに" />
          {done.map((l) => (
            <div key={l.id} style={{ ...S.card, opacity: 0.92 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{l.title}</div>
                <span style={{ ...S.badge, background: '#F2F2F7', color: '#3A3A3C', whiteSpace: 'nowrap' }}>
                  完了
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#6E6E73', marginTop: 4 }}>
                売上 {yen(l.price)} ・ 利益 {yen(l.price - l.cost - l.fee)}
                {l.trackingNo && <> ・ 追跡番号: {l.trackingNo}</>}
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
              <button style={{ ...S.miniBtn, marginTop: 10 }} onClick={() => undoComplete(l.id)}>
                間違えた場合: 対応中に戻す
              </button>
            </div>
          ))}
        </>
      )}

      {stopped.length > 0 && (
        <>
          <SectionTitle title="出品停止(在庫切れ等)" sub="" />
          {stopped.map((l) => (
            <div key={l.id} style={{ ...S.card, opacity: 0.7 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{l.title}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button style={{ ...S.secondaryBtn, flex: 1 }} onClick={() => removeListing(l.id)}>
                  削除
                </button>
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
  const sold = listings.filter((l) => l.status === '完了')
  const active = listings.filter((l) => l.status === '出品中' || l.status === '対応中')
  const sales = sold.reduce((a, l) => a + l.price, 0)
  const profit = sold.reduce((a, l) => a + (l.price - l.cost - l.fee), 0)

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const soldThisWeek = sold.filter((l) => new Date(l.shippedAt || l.soldAt).getTime() >= weekAgo)
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
// 画像加工ツール(仕入れ先スクショの軽加工用)
// 正方形トリミング + 明るさ/コントラスト + なぞって隠す(白塗り)
// ============================================================
const IMG_SIZE = 1000 // BASE推奨サイズに近い正方形で書き出し

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function ImageEditorModal({ file, onSave, onCancel }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [covers, setCovers] = useState([])
  const drawingRef = useRef(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setReady(true)
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  }, [file])

  const render = () => {
    const canvas = canvasRef.current
    if (!canvas || !imgRef.current) return
    const ctx = canvas.getContext('2d')
    canvas.width = IMG_SIZE
    canvas.height = IMG_SIZE
    const img = imgRef.current
    const scale = Math.max(IMG_SIZE / img.width, IMG_SIZE / img.height)
    const w = img.width * scale
    const h = img.height * scale
    const x = (IMG_SIZE - w) / 2
    const y = (IMG_SIZE - h) / 2
    ctx.clearRect(0, 0, IMG_SIZE, IMG_SIZE)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, IMG_SIZE, IMG_SIZE)
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`
    ctx.drawImage(img, x, y, w, h)
    ctx.filter = 'none'
    covers.forEach((c) => {
      ctx.fillStyle = 'rgba(255,255,255,0.97)'
      roundRectPath(ctx, c.x, c.y, c.w, c.h, 6)
      ctx.fill()
    })
  }

  useEffect(render, [ready, brightness, contrast, covers])

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const t = e.touches && e.touches[0]
    const clientX = t ? t.clientX : e.clientX
    const clientY = t ? t.clientY : e.clientY
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
  }

  const handleStart = (e) => {
    e.preventDefault()
    drawingRef.current = getPos(e)
  }
  const handleMove = (e) => {
    if (!drawingRef.current) return
    e.preventDefault()
    const pos = getPos(e)
    render()
    const ctx = canvasRef.current.getContext('2d')
    ctx.strokeStyle = '#0071E3'
    ctx.lineWidth = 3
    ctx.setLineDash([8, 6])
    const s = drawingRef.current
    ctx.strokeRect(Math.min(s.x, pos.x), Math.min(s.y, pos.y), Math.abs(pos.x - s.x), Math.abs(pos.y - s.y))
  }
  const handleEnd = (e) => {
    if (!drawingRef.current) return
    const t = e.changedTouches && e.changedTouches[0]
    const pos = t
      ? getPos({ touches: [t] })
      : getPos(e)
    const s = drawingRef.current
    const w = Math.abs(pos.x - s.x)
    const h = Math.abs(pos.y - s.y)
    if (w > 12 && h > 12) {
      setCovers((c) => [...c, { x: Math.min(s.x, pos.x), y: Math.min(s.y, pos.y), w, h }])
    } else {
      render()
    }
    drawingRef.current = null
  }

  const undoCover = () => setCovers((c) => c.slice(0, -1))
  const resetAll = () => {
    setBrightness(100)
    setContrast(100)
    setCovers([])
  }
  const save = () => {
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.85)
    onSave(dataUrl)
  }

  return (
    <div style={S.modalOverlay}>
      <div style={S.modalSheet}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>写真を加工</div>
        <div style={{ fontSize: 12, color: '#6E6E73', marginBottom: 12, lineHeight: 1.6 }}>
          指でなぞるとロゴ・価格・URLなどを白く隠せます。届いたら実物写真に差し替えるのが一番安全です。
        </div>

        <div style={S.canvasWrap}>
          <canvas
            ref={canvasRef}
            style={S.canvas}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={() => (drawingRef.current = null)}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />
          {!ready && <div style={S.canvasLoading}>読み込み中…</div>}
        </div>

        <label style={{ ...S.label, marginTop: 14 }}>明るさ {brightness}%</label>
        <input
          type="range"
          min="60"
          max="150"
          value={brightness}
          onChange={(e) => setBrightness(Number(e.target.value))}
          style={S.slider}
        />

        <label style={{ ...S.label, marginTop: 10 }}>コントラスト {contrast}%</label>
        <input
          type="range"
          min="60"
          max="150"
          value={contrast}
          onChange={(e) => setContrast(Number(e.target.value))}
          style={S.slider}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button style={{ ...S.miniBtn, flex: 1 }} onClick={undoCover} disabled={covers.length === 0}>
            隠したのを1つ戻す
          </button>
          <button style={{ ...S.miniBtn, flex: 1 }} onClick={resetAll}>
            全部やり直す
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button style={{ ...S.secondaryBtn, flex: 1 }} onClick={onCancel}>
            キャンセル
          </button>
          <button style={{ ...S.primaryBtn, flex: 2 }} onClick={save} disabled={!ready}>
            この写真を使う
          </button>
        </div>
      </div>
    </div>
  )
}

function ImageGallery({ images, onAdd, onRemove }) {
  const fileInputRef = useRef(null)
  const [editingFile, setEditingFile] = useState(null)

  const pickFile = () => fileInputRef.current && fileInputRef.current.click()

  const onFileChange = (e) => {
    const f = e.target.files && e.target.files[0]
    if (f) setEditingFile(f)
    e.target.value = ''
  }

  const saveImage = (dataUrl) => {
    onAdd(dataUrl)
    setEditingFile(null)
  }

  const downloadImage = (dataUrl, idx) => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `photo_${idx + 1}.jpg`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div>
      <label style={S.label}>商品写真({images.length}枚)</label>
      <div style={S.gallery}>
        {images.map((src, i) => (
          <div key={i} style={S.galleryItem}>
            <img src={src} alt="" style={S.galleryImg} />
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <button style={S.galleryBtn} onClick={() => downloadImage(src, i)}>保存</button>
              <button style={{ ...S.galleryBtn, color: '#C42B1C' }} onClick={() => onRemove(i)}>削除</button>
            </div>
          </div>
        ))}
        <button style={S.galleryAdd} onClick={pickFile}>
          ＋<br />追加
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />
      {editingFile && (
        <ImageEditorModal file={editingFile} onSave={saveImage} onCancel={() => setEditingFile(null)} />
      )}
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
  nudgeBox: {
    marginTop: 10, fontSize: 13, color: '#0055B0', background: '#EEF4FF',
    padding: '10px 12px', borderRadius: 12, lineHeight: 1.6,
  },
  sourceLink: {
    display: 'inline-block', marginTop: 8, fontSize: 13, fontWeight: 600, color: '#0071E3',
  },
  checkRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', fontSize: 14,
  },
  checkbox: {
    width: 20, height: 20, accentColor: '#0071E3', flexShrink: 0,
  },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  modalSheet: {
    width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto',
    background: '#FFFFFF', borderRadius: '24px 24px 0 0', padding: '20px 18px calc(20px + env(safe-area-inset-bottom))',
  },
  canvasWrap: {
    position: 'relative', width: '100%', aspectRatio: '1 / 1', background: '#F2F2F7',
    borderRadius: 16, overflow: 'hidden',
  },
  canvas: {
    width: '100%', height: '100%', display: 'block', touchAction: 'none',
  },
  canvasLoading: {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, color: '#8E8E93',
  },
  slider: { width: '100%', marginTop: 4, accentColor: '#0071E3' },
  gallery: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  galleryItem: { width: 84 },
  galleryImg: { width: 84, height: 84, objectFit: 'cover', borderRadius: 10, border: '1px solid #E5E5EA' },
  galleryBtn: {
    flex: 1, fontSize: 10, fontWeight: 600, color: '#0071E3', background: '#F2F2F7',
    borderRadius: 6, padding: '4px 0',
  },
  galleryAdd: {
    width: 84, height: 84, borderRadius: 10, border: '1.5px dashed #C7C7CC',
    background: '#FAFAFA', color: '#8E8E93', fontSize: 12, lineHeight: 1.4,
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
