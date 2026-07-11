// APIキーは Vercel の環境変数 VITE_ANTHROPIC_API_KEY に設定してください
// (Vercel → Settings → Environment Variables)
export const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || ''

// 運用モデル(日常リサーチ・文面生成)= 安価で高速な Sonnet を使用
// 設計・大規模修正は Fable 5 とのチャットで行う(コスト最適化方針)
export const OPERATION_MODEL = 'claude-sonnet-4-6'
