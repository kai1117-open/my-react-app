// couple-app の DB 同期を一箇所に集約するフック。
// App.jsx 既存の `setTransactions(prev => ...)` パターンと完全互換のセッターを返すことで、
// 既存コードの変更を最小化する。
//
// 戦略:
//   - useState で「楽観的に保持するローカル状態」を維持
//   - 各セッターは prev → next を計算した後、差分を Supabase に反映する非同期処理を発火
//   - エラー時はコンソール警告のみ (将来 toast 等に拡張)
//
// 注意:
//   このフックは「ログイン済み」であることを前提とする。未ログイン時は呼ばないこと。

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_SETTINGS = {
  expenseCategories: ['家賃', '食費', '外食', '交通費', '娯楽', '日用品', '医療', '衣類', '通信費', '保険'],
  incomeCategories: ['給与', '副収入', 'ボーナス', '投資', 'その他'],
  placeGenres: ['公園', '観光', 'カフェ', '美術館', 'アウトドア', '動物園', 'レストラン', '温泉', 'ショッピング', '映画館'],
  scheduleCategories: ['デート', '買い物', '旅行', '家事', '支払い', 'イベント', 'その他'],
}

// ============================================================
//  Storage helpers — 場所写真 (Base64 → Storage オブジェクト)
// ============================================================
const BUCKET = 'place-images'

async function uploadDataUrl(dataUrl) {
  // dataUrl: "data:image/png;base64,...." の形式
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl || '')
  if (!match) return null
  const mime = match[1]
  const ext = mime.split('/')[1].replace('+', '-') || 'bin'
  const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0))
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: false,
  })
  if (error) {
    console.warn('[couple-app] image upload failed', error)
    return null
  }
  return path
}

function publicUrlFor(path) {
  if (!path) return null
  // バケットが private のため signed URL を使うのが本来。今回は閲覧範囲が認証済みのみ → public URL でOK。
  // ただし bucket は public:false で作成済みなので、ここでは createSignedUrl は使わず、
  // Supabase の getPublicUrl は bucket=public が前提なので、署名URLを返すヘルパに切り替える。
  return path
}

async function getDisplayUrl(path) {
  if (!path) return null
  if (path.startsWith('data:') || path.startsWith('http')) return path
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60) // 1時間有効
  if (error) return null
  return data.signedUrl
}

// 行 → app オブジェクト変換
function placeFromRow(r) {
  return {
    id: r.id,
    name: r.name,
    genre: r.genre,
    targetDate: r.target_date || '',
    visitedDate: r.visited_date || '',
    address: r.address || '',
    memo: r.memo || '',
    emoji: r.emoji || '',
    status: r.status,
    images: Array.isArray(r.image_paths) ? r.image_paths : [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function transactionFromRow(r) {
  return {
    id: r.id,
    type: r.type,
    amount: r.amount,
    category: r.category,
    date: r.date,
    memo: r.memo || '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function scheduleFromRow(r) {
  return {
    id: r.id,
    title: r.title,
    date: r.date,
    category: r.category,
    memo: r.memo || '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function settingsFromRow(r) {
  if (!r) return DEFAULT_SETTINGS
  return {
    expenseCategories: r.expense_categories || DEFAULT_SETTINGS.expenseCategories,
    incomeCategories: r.income_categories || DEFAULT_SETTINGS.incomeCategories,
    placeGenres: r.place_genres || DEFAULT_SETTINGS.placeGenres,
    scheduleCategories: r.schedule_categories || DEFAULT_SETTINGS.scheduleCategories,
  }
}

// ============================================================
//  メインフック
// ============================================================
export function useCoupleAppData() {
  const [transactions, setTransactionsLocal] = useState([])
  const [places, setPlacesLocal] = useState([])
  const [schedules, setSchedulesLocal] = useState([])
  const [settings, setSettingsLocal] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  // 場所画像の表示URLキャッシュ (path -> signedUrl)
  const [imageUrlMap, setImageUrlMap] = useState({})
  const inflightUrls = useRef(new Set())

  // ----- 初回ロード -----
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const [tx, pl, sc, st] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('places').select('*').order('id', { ascending: true }),
        supabase.from('schedules').select('*').order('date', { ascending: true }),
        supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
      ])
      if (!mounted) return
      if (tx.data) setTransactionsLocal(tx.data.map(transactionFromRow))
      if (pl.data) setPlacesLocal(pl.data.map(placeFromRow))
      if (sc.data) setSchedulesLocal(sc.data.map(scheduleFromRow))
      setSettingsLocal(settingsFromRow(st.data))
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [])

  // ----- 場所画像の signed URL を都度取得 -----
  useEffect(() => {
    const paths = new Set()
    places.forEach((p) => (p.images || []).forEach((path) => path && paths.add(path)))
    paths.forEach(async (path) => {
      if (path.startsWith('data:') || path.startsWith('http')) return
      if (imageUrlMap[path] || inflightUrls.current.has(path)) return
      inflightUrls.current.add(path)
      const url = await getDisplayUrl(path)
      inflightUrls.current.delete(path)
      if (url) setImageUrlMap((prev) => ({ ...prev, [path]: url }))
    })
  }, [places, imageUrlMap])

  // place.images に格納された Storage パスを表示用URLへ展開した版
  const placesForDisplay = places.map((p) => ({
    ...p,
    images: (p.images || []).map((path) => imageUrlMap[path] || path),
  }))

  // ============================================================
  //  Mutation API — App.jsx の既存セッター呼び出しと互換
  // ============================================================

  // ---- Transactions ----
  const setTransactions = useCallback(
    (updater) => {
      setTransactionsLocal((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        syncTransactions(prev, next)
        return next
      })
    },
    [],
  )

  async function syncTransactions(prev, next) {
    const prevById = new Map(prev.map((x) => [x.id, x]))
    const nextById = new Map(next.map((x) => [x.id, x]))

    // INSERT (next にあって prev に無い)
    for (const item of next) {
      if (prevById.has(item.id)) continue
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          type: item.type,
          amount: Number(item.amount),
          category: item.category,
          date: item.date,
          memo: item.memo || '',
        })
        .select()
        .single()
      if (error) {
        console.warn('[couple-app] tx insert failed', error)
        continue
      }
      // ローカルIDをDB採番IDに差し替え
      const inserted = transactionFromRow(data)
      setTransactionsLocal((cur) => cur.map((x) => (x.id === item.id ? inserted : x)))
    }

    // UPDATE (両方に存在し、updatedAt 以外で差分がある)
    for (const item of next) {
      const before = prevById.get(item.id)
      if (!before) continue
      if (shallowEqualTx(before, item)) continue
      const { error } = await supabase
        .from('transactions')
        .update({
          type: item.type,
          amount: Number(item.amount),
          category: item.category,
          date: item.date,
          memo: item.memo || '',
        })
        .eq('id', item.id)
      if (error) console.warn('[couple-app] tx update failed', error)
    }

    // DELETE
    for (const item of prev) {
      if (nextById.has(item.id)) continue
      const { error } = await supabase.from('transactions').delete().eq('id', item.id)
      if (error) console.warn('[couple-app] tx delete failed', error)
    }
  }

  // ---- Schedules ----
  const setSchedules = useCallback((updater) => {
    setSchedulesLocal((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      syncSchedules(prev, next)
      return next
    })
  }, [])

  async function syncSchedules(prev, next) {
    const prevById = new Map(prev.map((x) => [x.id, x]))
    const nextById = new Map(next.map((x) => [x.id, x]))

    for (const item of next) {
      if (prevById.has(item.id)) continue
      const { data, error } = await supabase
        .from('schedules')
        .insert({
          title: item.title,
          date: item.date,
          category: item.category,
          memo: item.memo || '',
        })
        .select()
        .single()
      if (error) {
        console.warn('[couple-app] sc insert failed', error)
        continue
      }
      const inserted = scheduleFromRow(data)
      setSchedulesLocal((cur) => cur.map((x) => (x.id === item.id ? inserted : x)))
    }

    for (const item of next) {
      const before = prevById.get(item.id)
      if (!before) continue
      if (shallowEqualSc(before, item)) continue
      const { error } = await supabase
        .from('schedules')
        .update({
          title: item.title,
          date: item.date,
          category: item.category,
          memo: item.memo || '',
        })
        .eq('id', item.id)
      if (error) console.warn('[couple-app] sc update failed', error)
    }

    for (const item of prev) {
      if (nextById.has(item.id)) continue
      const { error } = await supabase.from('schedules').delete().eq('id', item.id)
      if (error) console.warn('[couple-app] sc delete failed', error)
    }
  }

  // ---- Places ----
  const setPlaces = useCallback((updater) => {
    setPlacesLocal((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      syncPlaces(prev, next)
      return next
    })
  }, [])

  async function syncPlaces(prev, next) {
    const prevById = new Map(prev.map((x) => [x.id, x]))
    const nextById = new Map(next.map((x) => [x.id, x]))

    for (const item of next) {
      if (prevById.has(item.id)) continue
      // images に dataURL が混じっていれば Storage にアップロードしてパス化
      const imagePaths = []
      for (const v of item.images || []) {
        if (typeof v === 'string' && v.startsWith('data:')) {
          const path = await uploadDataUrl(v)
          if (path) imagePaths.push(path)
        } else if (v) {
          imagePaths.push(v)
        }
      }
      const { data, error } = await supabase
        .from('places')
        .insert({
          name: item.name,
          genre: item.genre,
          target_date: item.targetDate || null,
          visited_date: item.visitedDate || null,
          address: item.address || '',
          memo: item.memo || '',
          emoji: item.emoji || '',
          status: item.status || 'want',
          image_paths: imagePaths,
        })
        .select()
        .single()
      if (error) {
        console.warn('[couple-app] place insert failed', error)
        continue
      }
      const inserted = placeFromRow(data)
      setPlacesLocal((cur) => cur.map((x) => (x.id === item.id ? inserted : x)))
    }

    for (const item of next) {
      const before = prevById.get(item.id)
      if (!before) continue
      if (shallowEqualPlace(before, item)) continue
      // 画像差分: dataURL があればアップロード、それ以外はそのまま
      const imagePaths = []
      for (const v of item.images || []) {
        if (typeof v === 'string' && v.startsWith('data:')) {
          const path = await uploadDataUrl(v)
          if (path) imagePaths.push(path)
        } else if (typeof v === 'string' && v.startsWith('http')) {
          // signed URL は永続化しない (元のパスに戻す方法が無いのでスキップ)
          continue
        } else if (v) {
          imagePaths.push(v)
        }
      }
      const { error } = await supabase
        .from('places')
        .update({
          name: item.name,
          genre: item.genre,
          target_date: item.targetDate || null,
          visited_date: item.visitedDate || null,
          address: item.address || '',
          memo: item.memo || '',
          emoji: item.emoji || '',
          status: item.status,
          image_paths: imagePaths.length ? imagePaths : (before.images || []),
        })
        .eq('id', item.id)
      if (error) console.warn('[couple-app] place update failed', error)
    }

    for (const item of prev) {
      if (nextById.has(item.id)) continue
      const { error } = await supabase.from('places').delete().eq('id', item.id)
      if (error) console.warn('[couple-app] place delete failed', error)
    }
  }

  // ---- Settings ----
  const setSettings = useCallback((updater) => {
    setSettingsLocal((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      ;(async () => {
        const { error } = await supabase
          .from('app_settings')
          .update({
            expense_categories: next.expenseCategories,
            income_categories: next.incomeCategories,
            place_genres: next.placeGenres,
            schedule_categories: next.scheduleCategories,
          })
          .eq('id', 1)
        if (error) console.warn('[couple-app] settings update failed', error)
      })()
      return next
    })
  }, [])

  return {
    loading,
    transactions,
    setTransactions,
    schedules,
    setSchedules,
    places: placesForDisplay,
    setPlaces,
    settings,
    setSettings,
  }
}

// ============================================================
//  shallow equality helpers
// ============================================================
function shallowEqualTx(a, b) {
  return (
    a.type === b.type &&
    Number(a.amount) === Number(b.amount) &&
    a.category === b.category &&
    a.date === b.date &&
    (a.memo || '') === (b.memo || '')
  )
}
function shallowEqualSc(a, b) {
  return a.title === b.title && a.date === b.date && a.category === b.category && (a.memo || '') === (b.memo || '')
}
function shallowEqualPlace(a, b) {
  return (
    a.name === b.name &&
    a.genre === b.genre &&
    a.targetDate === b.targetDate &&
    a.visitedDate === b.visitedDate &&
    (a.address || '') === (b.address || '') &&
    (a.memo || '') === (b.memo || '') &&
    a.emoji === b.emoji &&
    a.status === b.status &&
    JSON.stringify(a.images || []) === JSON.stringify(b.images || [])
  )
}
