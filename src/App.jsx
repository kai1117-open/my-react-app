import { useEffect, useMemo, useState } from 'react'
import './App.css'
import Login from './components/Login'
import { useAuth } from './hooks/useAuth'
import { useCoupleAppData } from './hooks/useCoupleAppData'
import { supabase } from './lib/supabase'

// localStorage と同期する useState フック。
// 初回マウント時に読み込み、変更時に書き戻す。SSR/プライベートモードでも安全に動くよう try/catch で防御。
const STORAGE_PREFIX = 'couple-app:v1:'
function usePersistentState(key, initialValue) {
  const storageKey = STORAGE_PREFIX + key
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return initialValue
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw === null) return initialValue
      return JSON.parse(raw)
    } catch (err) {
      console.warn('[couple-app] localStorage read failed for', storageKey, err)
      return initialValue
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value))
    } catch (err) {
      // QuotaExceededError 等。画像 Base64 が大きすぎる場合に発生し得る。
      console.warn('[couple-app] localStorage write failed for', storageKey, err)
    }
  }, [storageKey, value])

  return [value, setValue]
}

const TODAY = new Date(2026, 3, 26)

const GENRE_GRADIENT = {
  公園: 'linear-gradient(135deg,#b8f0d4,#52c787)',
  観光: 'linear-gradient(135deg,#ffd6a0,#f09540)',
  カフェ: 'linear-gradient(135deg,#f5d5b8,#c8845a)',
  美術館: 'linear-gradient(135deg,#d8c8f8,#9b72d0)',
  アウトドア: 'linear-gradient(135deg,#b4def8,#4a9ed9)',
  動物園: 'linear-gradient(135deg,#fff0a8,#f0c030)',
  レストラン: 'linear-gradient(135deg,#ffc0c0,#e05050)',
  温泉: 'linear-gradient(135deg,#b8e8f8,#30b0e8)',
  ショッピング: 'linear-gradient(135deg,#ffc8e0,#e060a0)',
  映画館: 'linear-gradient(135deg,#c8c8c8,#606060)',
}

const EMOJI_MAP = {
  公園: '🌸',
  観光: '⛩️',
  カフェ: '☕',
  美術館: '🎨',
  アウトドア: '🗻',
  動物園: '🐼',
  レストラン: '🍽️',
  温泉: '♨️',
  ショッピング: '🛍️',
  映画館: '🎬',
}

const initialSettings = {
  expenseCategories: ['家賃', '食費', '外食', '交通費', '娯楽', '日用品', '医療', '衣類', '通信費', '保険'],
  incomeCategories: ['給与', '副収入', 'ボーナス', '投資', 'その他'],
  placeGenres: ['公園', '観光', 'カフェ', '美術館', 'アウトドア', '動物園', 'レストラン', '温泉', 'ショッピング', '映画館'],
  scheduleCategories: ['デート', '買い物', '旅行', '家事', '支払い', 'イベント', 'その他'],
}

const initialTransactions = [
  { id: 1, type: 'income', amount: 280000, category: '給与', date: '2026-04-25', memo: '4月分給与', createdAt: '2026-04-25', updatedAt: '2026-04-25' },
  { id: 2, type: 'income', amount: 45000, category: '副収入', date: '2026-04-18', memo: 'フリーランス案件', createdAt: '2026-04-18', updatedAt: '2026-04-18' },
  { id: 3, type: 'expense', amount: 85000, category: '家賃', date: '2026-04-01', memo: '4月家賃', createdAt: '2026-04-01', updatedAt: '2026-04-01' },
  { id: 4, type: 'expense', amount: 14200, category: '食費', date: '2026-04-14', memo: 'スーパーまとめ買い', createdAt: '2026-04-14', updatedAt: '2026-04-14' },
  { id: 5, type: 'expense', amount: 7600, category: '外食', date: '2026-04-19', memo: 'イタリアンディナー', createdAt: '2026-04-19', updatedAt: '2026-04-19' },
  { id: 6, type: 'expense', amount: 3200, category: '交通費', date: '2026-04-10', memo: '電車代', createdAt: '2026-04-10', updatedAt: '2026-04-10' },
  { id: 7, type: 'expense', amount: 5400, category: '娯楽', date: '2026-04-22', memo: '映画・ポップコーン', createdAt: '2026-04-22', updatedAt: '2026-04-22' },
  { id: 8, type: 'expense', amount: 12800, category: '日用品', date: '2026-04-08', memo: 'ニトリ', createdAt: '2026-04-08', updatedAt: '2026-04-08' },
  { id: 9, type: 'expense', amount: 3800, category: '食費', date: '2026-04-24', memo: 'コンビニ', createdAt: '2026-04-24', updatedAt: '2026-04-24' },
  { id: 10, type: 'income', amount: 280000, category: '給与', date: '2026-03-25', memo: '3月分給与', createdAt: '2026-03-25', updatedAt: '2026-03-25' },
  { id: 11, type: 'expense', amount: 85000, category: '家賃', date: '2026-03-01', memo: '3月家賃', createdAt: '2026-03-01', updatedAt: '2026-03-01' },
  { id: 12, type: 'expense', amount: 9800, category: '食費', date: '2026-03-12', memo: 'スーパー', createdAt: '2026-03-12', updatedAt: '2026-03-12' },
  { id: 13, type: 'expense', amount: 5200, category: '外食', date: '2026-03-15', memo: 'ランチ', createdAt: '2026-03-15', updatedAt: '2026-03-15' },
  { id: 14, type: 'expense', amount: 3200, category: '交通費', date: '2026-03-08', memo: '電車代', createdAt: '2026-03-08', updatedAt: '2026-03-08' },
  { id: 15, type: 'expense', amount: 22000, category: '娯楽', date: '2026-03-20', memo: '旅行費', createdAt: '2026-03-20', updatedAt: '2026-03-20' },
  { id: 16, type: 'expense', amount: 6500, category: '日用品', date: '2026-03-05', memo: '薬局', createdAt: '2026-03-05', updatedAt: '2026-03-05' },
]

const initialPlaces = [
  { id: 1, name: '新宿御苑', genre: '公園', targetDate: '2026-05-10', visitedDate: '', address: '新宿区内藤町11', memo: '', images: [], emoji: '🌸', status: 'want', createdAt: '2026-04-01', updatedAt: '2026-04-01' },
  { id: 2, name: '浅草寺', genre: '観光', targetDate: '2026-04-20', visitedDate: '2026-04-20', address: '台東区浅草2-3-1', memo: '仲見世も楽しかった', images: [], emoji: '⛩️', status: 'visited', createdAt: '2026-04-01', updatedAt: '2026-04-20' },
  { id: 3, name: 'cafe marble 仏光寺', genre: 'カフェ', targetDate: '2026-06-01', visitedDate: '', address: '京都市下京区', memo: '', images: [], emoji: '☕', status: 'want', createdAt: '2026-04-01', updatedAt: '2026-04-01' },
  { id: 4, name: '箱根ガラスの森', genre: '美術館', targetDate: '2026-07-15', visitedDate: '', address: '神奈川県足柄下郡箱根町', memo: '', images: [], emoji: '🎨', status: 'want', createdAt: '2026-04-01', updatedAt: '2026-04-01' },
  { id: 5, name: '長谷寺（鎌倉）', genre: '観光', targetDate: '2026-06-20', visitedDate: '2026-06-20', address: '鎌倉市長谷3-11-2', memo: '', images: [], emoji: '🪷', status: 'visited', createdAt: '2026-04-01', updatedAt: '2026-06-20' },
  { id: 6, name: 'bills 七里ヶ浜', genre: 'カフェ', targetDate: '2026-05-30', visitedDate: '', address: '鎌倉市七里ガ浜東', memo: '', images: [], emoji: '🥞', status: 'want', createdAt: '2026-04-01', updatedAt: '2026-04-01' },
  { id: 7, name: '富士山五合目', genre: 'アウトドア', targetDate: '2026-08-01', visitedDate: '', address: '富士宮市粟倉', memo: '', images: [], emoji: '🗻', status: 'want', createdAt: '2026-04-01', updatedAt: '2026-04-01' },
  { id: 8, name: '上野動物園', genre: '動物園', targetDate: '2026-05-05', visitedDate: '2026-05-05', address: '台東区上野公園9-83', memo: 'パンダが可愛かった', images: [], emoji: '🐼', status: 'visited', createdAt: '2026-04-01', updatedAt: '2026-05-05' },
]

const initialSchedules = []

const fmtNum = (n) => Number(n).toLocaleString('ja-JP')
const getDays = (y, m) => new Date(y, m + 1, 0).getDate()
const firstDow = (y, m) => new Date(y, m, 1).getDay()
const nowIso = () => new Date().toISOString().slice(0, 10)
const genId = () => Date.now() + Math.floor(Math.random() * 1000)

function Modal({ children, center = false, onClose }) {
  return (
    <div className={`modal-overlay${center ? ' center' : ''}`} onClick={onClose}>
      <div className={`modal-sheet${center ? ' center-modal' : ''}`} onClick={(e) => e.stopPropagation()}>
        {!center && <div className="modal-handle" />}
        {children}
      </div>
    </div>
  )
}

function ConfirmModal({ title, message, onCancel, onConfirm }) {
  return (
    <Modal center onClose={onCancel}>
      <h3 className="modal-title">{title}</h3>
      <div className="confirm-dialog">
        <p>{message}</p>
        <div className="confirm-btns">
          <button className="confirm-cancel" onClick={onCancel}>キャンセル</button>
          <button className="confirm-ok" onClick={onConfirm}>削除する</button>
        </div>
      </div>
    </Modal>
  )
}

function TabBar({ active, onSelect }) {
  const tabs = [
    { id: 'calendar', icon: '📅', label: 'カレンダー' },
    { id: 'places', icon: '📍', label: '行きたい' },
    { id: 'analysis', icon: '📊', label: '分析' },
    { id: 'settings', icon: '⚙️', label: '設定' },
  ]

  return (
    <nav className="tab-bar">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`tab-btn${active === t.id ? ' active' : ''}`}
          onClick={() => onSelect(t.id)}
        >
          <span className="tab-icon">{t.icon}</span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

function TopActionBar({ onAddIncome, onAddExpense, onAddSchedule, onAddPlace }) {
  return (
    <div className="top-action-bar">
      <button className="top-btn top-btn-income" onClick={onAddIncome}>＋ 収入</button>
      <button className="top-btn top-btn-expense" onClick={onAddExpense}>＋ 支出</button>
      <button className="top-btn top-btn-schedule" onClick={onAddSchedule}>＋ 予定</button>
      <button className="top-btn top-btn-place" onClick={onAddPlace}>＋ 行きたい</button>
    </div>
  )
}

function TransactionFormModal({ type, categories, existing, defaultDate, onClose, onSubmit }) {
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [category, setCategory] = useState(existing ? existing.category : categories[0] || '')
  const [date, setDate] = useState(existing ? existing.date : defaultDate || TODAY.toISOString().slice(0, 10))
  const [memo, setMemo] = useState(existing ? existing.memo : '')
  const [errors, setErrors] = useState({})
  const title = type === 'income' ? '💚 収入を追加' : '🌸 支出を追加'

  const handleSubmit = () => {
    const nextErrors = {}
    const amountNum = parseInt(amount, 10)

    if (!amount || Number.isNaN(amountNum) || amountNum <= 0) nextErrors.amount = '金額は1円以上で入力してください'
    if (!category) nextErrors.category = 'カテゴリーを選択してください'
    if (!date) nextErrors.date = '日付を選択してください'
    if (!memo.trim()) nextErrors.memo = 'タイトルまたはメモを入力してください'

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    onSubmit({
      amount: amountNum,
      category,
      date,
      memo: memo.trim(),
    })
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="modal-title">{title}</h3>

      <div className="form-group">
        <label className="form-label">金額</label>
        <div className="amount-wrap">
          <span className="yen-sign">¥</span>
          <input
            className={`form-input amount-input${errors.amount ? ' error' : ''}`}
            type="number"
            placeholder="0"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className={`form-error${errors.amount ? ' visible' : ''}`}>{errors.amount}</div>
      </div>

      <div className="form-group">
        <label className="form-label">カテゴリー</label>
        <div className="chip-wrap">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`cat-chip${category === c ? ' selected' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className={`form-error${errors.category ? ' visible' : ''}`}>{errors.category}</div>
      </div>

      <div className="form-group">
        <label className="form-label">日付</label>
        <input
          className={`form-input${errors.date ? ' error' : ''}`}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className={`form-error${errors.date ? ' visible' : ''}`}>{errors.date}</div>
      </div>

      <div className="form-group">
        <label className="form-label">メモ</label>
        <input
          className={`form-input${errors.memo ? ' error' : ''}`}
          type="text"
          placeholder="メモを入力..."
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
        <div className={`form-error${errors.memo ? ' visible' : ''}`}>{errors.memo}</div>
      </div>

      <button className={`submit-btn submit-${type}`} onClick={handleSubmit}>
        {existing ? '更新する' : '追加する'}
      </button>
      <button className="btn-close-full" onClick={onClose}>キャンセル</button>
    </Modal>
  )
}

function ScheduleFormModal({ categories, existing, defaultDate, onClose, onSubmit }) {
  const [title, setTitle] = useState(existing ? existing.title : '')
  const [date, setDate] = useState(existing ? existing.date : defaultDate || TODAY.toISOString().slice(0, 10))
  const [category, setCategory] = useState(existing ? existing.category : categories[0] || '')
  const [memo, setMemo] = useState(existing ? existing.memo : '')
  const [errors, setErrors] = useState({})

  const handleSubmit = () => {
    const nextErrors = {}
    if (!title.trim()) nextErrors.title = 'タイトルを入力してください'
    if (!date) nextErrors.date = '日付を選択してください'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    onSubmit({
      title: title.trim(),
      date,
      category,
      memo: memo.trim(),
    })
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="modal-title">📅 {existing ? '予定を編集' : '予定を追加'}</h3>

      <div className="form-group">
        <label className="form-label">タイトル</label>
        <input
          className={`form-input${errors.title ? ' error' : ''}`}
          type="text"
          placeholder="予定のタイトル"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className={`form-error${errors.title ? ' visible' : ''}`}>{errors.title}</div>
      </div>

      <div className="form-group">
        <label className="form-label">日付</label>
        <input
          className={`form-input${errors.date ? ' error' : ''}`}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className={`form-error${errors.date ? ' visible' : ''}`}>{errors.date}</div>
      </div>

      <div className="form-group">
        <label className="form-label">カテゴリー</label>
        <div className="chip-wrap">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`cat-chip${category === c ? ' selected' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">メモ</label>
        <input
          className="form-input"
          type="text"
          placeholder="メモ（任意）"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </div>

      <button className="submit-btn submit-blue" onClick={handleSubmit}>
        {existing ? '更新する' : '追加する'}
      </button>
      <button className="btn-close-full" onClick={onClose}>キャンセル</button>
    </Modal>
  )
}

function PlaceFormModal({ genres, existing, defaultTargetDate, onClose, onSubmit }) {
  const [name, setName] = useState(existing ? existing.name : '')
  const [genre, setGenre] = useState(existing ? existing.genre : '')
  const [targetDate, setTargetDate] = useState(existing ? existing.targetDate : defaultTargetDate || '')
  const [address, setAddress] = useState(existing ? existing.address : '')
  const [memo, setMemo] = useState(existing ? existing.memo : '')
  const [status, setStatus] = useState(existing ? existing.status : 'want')
  const [imageData, setImageData] = useState(existing?.images?.[0] || null)
  const [errors, setErrors] = useState({})

  const handleFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => setImageData(e.target?.result || null)
    reader.readAsDataURL(file)
  }

  const handleSubmit = () => {
    const nextErrors = {}
    if (!name.trim()) nextErrors.name = '場所名を入力してください'
    if (!genre) nextErrors.genre = 'ジャンルを選択してください'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    onSubmit({
      name: name.trim(),
      genre,
      targetDate,
      address: address.trim(),
      memo: memo.trim(),
      status,
      imageData,
    })
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="modal-title">📍 {existing ? '場所を編集' : '場所を追加'}</h3>

      <div className="form-group">
        <label className="form-label">場所名 *</label>
        <input
          className={`form-input${errors.name ? ' error' : ''}`}
          type="text"
          placeholder="場所の名前"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className={`form-error${errors.name ? ' visible' : ''}`}>{errors.name}</div>
      </div>

      <div className="form-group">
        <label className="form-label">ジャンル *</label>
        <select
          className={`select-input${errors.genre ? ' error' : ''}`}
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
        >
          <option value="">選択してください</option>
          {genres.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <div className={`form-error${errors.genre ? ' visible' : ''}`}>{errors.genre}</div>
      </div>

      <div className="form-group">
        <label className="form-label">行きたい目安日</label>
        <input
          className="form-input"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">住所</label>
        <input
          className="form-input"
          type="text"
          placeholder="住所"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">メモ</label>
        <input
          className="form-input"
          type="text"
          placeholder="メモ（任意）"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">サムネイル画像</label>
        <label className="image-upload-area">
          {imageData ? (
            <>
              <img src={imageData} alt="preview" />
              <span id="img-placeholder">タップして変更</span>
            </>
          ) : (
            <span id="img-placeholder">📷 タップして画像を追加</span>
          )}
          <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} />
        </label>
      </div>

      <div className="form-group">
        <label className="form-label">ステータス</label>
        <select className="select-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="want">行きたい</option>
          <option value="visited">行った</option>
        </select>
      </div>

      <button className="submit-btn submit-purple" onClick={handleSubmit}>
        {existing ? '更新する' : '追加する'}
      </button>
      <button className="btn-close-full" onClick={onClose}>キャンセル</button>
    </Modal>
  )
}

function TransactionDetailModal({ tx, onClose, onEdit, onDelete }) {
  return (
    <Modal onClose={onClose}>
      <h3 className="modal-title">{tx.type === 'income' ? '💚 収入' : '🌸 支出'}明細</h3>
      <div className={`detail-amount-big ${tx.type}`}>{tx.type === 'income' ? '+' : '−'}¥{fmtNum(tx.amount)}</div>
      <div className="detail-row"><span className="detail-label">カテゴリー</span><span className="detail-value">{tx.category}</span></div>
      <div className="detail-row"><span className="detail-label">日付</span><span className="detail-value">{tx.date}</span></div>
      <div className="detail-row"><span className="detail-label">メモ</span><span className="detail-value">{tx.memo || '—'}</span></div>
      <div className="btn-row">
        <button className="btn-edit" onClick={onEdit}>✏️ 編集</button>
        <button className="btn-delete" onClick={onDelete}>🗑 削除</button>
      </div>
      <button className="btn-close-full" onClick={onClose}>閉じる</button>
    </Modal>
  )
}

function ScheduleDetailModal({ schedule, onClose, onEdit, onDelete }) {
  return (
    <Modal onClose={onClose}>
      <h3 className="modal-title">📅 予定の詳細</h3>
      <div className="detail-row"><span className="detail-label">タイトル</span><span className="detail-value detail-strong">{schedule.title}</span></div>
      <div className="detail-row"><span className="detail-label">日付</span><span className="detail-value">{schedule.date}</span></div>
      <div className="detail-row"><span className="detail-label">カテゴリー</span><span className="detail-value">{schedule.category}</span></div>
      <div className="detail-row"><span className="detail-label">メモ</span><span className="detail-value">{schedule.memo || '—'}</span></div>
      <div className="btn-row">
        <button className="btn-edit" onClick={onEdit}>✏️ 編集</button>
        <button className="btn-delete" onClick={onDelete}>🗑 削除</button>
      </div>
      <button className="btn-close-full" onClick={onClose}>閉じる</button>
    </Modal>
  )
}

function PlaceDetailModal({ place, onClose, onEdit, onDelete, onStampVisited }) {
  const grad = GENRE_GRADIENT[place.genre] || '#eee'

  return (
    <Modal onClose={onClose}>
      <h3 className="modal-title">
        {place.name}
        {place.status === 'visited'
          ? <span className="tag-visited">✅ 行った</span>
          : <span className="tag-want">💕 行きたい</span>}
      </h3>

      {place.images?.length ? (
        <img src={place.images[0]} className="place-memo-thumb" alt={place.name} />
      ) : (
        <div
          style={{
            height: 100,
            background: grad,
            borderRadius: 'var(--r-m)',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 40,
          }}
        >
          {place.emoji || '📍'}
        </div>
      )}

      <div className="detail-row"><span className="detail-label">ジャンル</span><span className="detail-value">{place.genre}</span></div>
      <div className="detail-row"><span className="detail-label">目安日</span><span className="detail-value">{place.targetDate || '—'}</span></div>
      {place.visitedDate && <div className="detail-row"><span className="detail-label">訪問日</span><span className="detail-value">{place.visitedDate}</span></div>}
      <div className="detail-row"><span className="detail-label">住所</span><span className="detail-value">{place.address || '—'}</span></div>
      <div className="detail-row"><span className="detail-label">メモ</span><span className="detail-value">{place.memo || '—'}</span></div>

      {place.status === 'want' && (
        <button className="btn-stamp" onClick={onStampVisited}>🗺️ 行ったスタンプを押す</button>
      )}

      <div className="btn-row">
        <button className="btn-edit" onClick={onEdit}>✏️ 編集</button>
        <button className="btn-delete" onClick={onDelete}>🗑 削除</button>
      </div>
      <button className="btn-close-full" onClick={onClose}>閉じる</button>
    </Modal>
  )
}

function CategoryFormModal({ title, initialValue = '', onClose, onSubmit }) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState('')

  const handleSubmit = () => {
    if (!value.trim()) {
      setError('名称を入力してください')
      return
    }
    onSubmit(value.trim())
  }

  return (
    <Modal center onClose={onClose}>
      <h3 className="modal-title">{title}</h3>
      <div className="form-group">
        <label className="form-label">名称</label>
        <input
          className={`form-input${error ? ' error' : ''}`}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (error) setError('')
          }}
          placeholder="新しい名称を入力"
        />
        <div className={`form-error${error ? ' visible' : ''}`}>{error}</div>
      </div>
      <button className="submit-btn submit-purple" onClick={handleSubmit}>保存する</button>
      <button className="btn-close-full" onClick={onClose}>キャンセル</button>
    </Modal>
  )
}

function CategoryDetailModal({ title, name, onClose, onEdit, onDelete }) {
  return (
    <Modal center onClose={onClose}>
      <h3 className="modal-title">{name}</h3>
      <div className="detail-row"><span className="detail-label">種別</span><span className="detail-value">{title}</span></div>
      <div className="btn-row">
        <button className="btn-edit" onClick={onEdit}>✏️ 編集</button>
        <button className="btn-delete" onClick={onDelete}>🗑 削除</button>
      </div>
      <button className="btn-close-full" onClick={onClose}>閉じる</button>
    </Modal>
  )
}

function DayDetailModal({
  dateStr,
  dayIncome,
  dayExpense,
  daySchedules,
  onClose,
  onAddIncome,
  onAddExpense,
  onAddSchedule,
  onAddPlace,
}) {
  const txItemHtml = (arr, type) => (
    arr.length ? (
      arr.map((t) => (
        <div className="day-tx-item" key={t.id}>
          <div>
            <span className={`day-tx-cat ${type}`}>{t.category}</span>
            <div className="day-tx-memo">{t.memo}</div>
          </div>
          <span className={`day-tx-amount ${type}`}>{type === 'income' ? '+' : '−'}¥{fmtNum(t.amount)}</span>
        </div>
      ))
    ) : (
      <div className="day-empty-text">この日の明細はありません</div>
    )
  )

  return (
    <Modal onClose={onClose}>
      <h3 className="modal-title">{dateStr.replaceAll('-', '年').replace(/年(\d{2})$/, '月$1日')}</h3>

      <div className="day-action-row">
        <button className="day-action-btn income" onClick={onAddIncome}>＋ 収入</button>
        <button className="day-action-btn expense" onClick={onAddExpense}>＋ 支出</button>
        <button className="day-action-btn schedule" onClick={onAddSchedule}>＋ 予定</button>
        <button className="day-action-btn place" onClick={onAddPlace}>＋ 行きたい</button>
      </div>

      <div className="day-section-title">💚 収入</div>
      {txItemHtml(dayIncome, 'income')}

      <div className="day-section-title">🌸 支出</div>
      {txItemHtml(dayExpense, 'expense')}

      <div className="day-section-title">📅 予定</div>
      {daySchedules.length ? (
        daySchedules.map((s) => (
          <div className="day-tx-item" key={s.id}>
            <div>
              <span className="day-tx-cat schedule">{s.category}</span>
              <div className="day-tx-memo">{s.title}</div>
            </div>
          </div>
        ))
      ) : (
        <div className="day-empty-text">この日の予定はありません</div>
      )}

      <button className="btn-close-full" onClick={onClose}>閉じる</button>
    </Modal>
  )
}

// トップレベルコンポーネント: 認証ゲート
export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-root">
        <div className="app-loading">読み込み中…</div>
      </div>
    )
  }
  if (!session) return <Login />
  return <CoupleApp />
}

// ログイン後の本体コンポーネント
function CoupleApp() {
  const [activeTab, setActiveTab] = useState('calendar')
  const [innerTab, setInnerTab] = useState('detail')
  const [viewYear, setViewYear] = useState(TODAY.getFullYear())
  const [viewMonth, setViewMonth] = useState(TODAY.getMonth())
  const [placeFilter, setPlaceFilter] = useState('all')

  // Phase 2: Supabase に保存される共有データ。
  // App.jsx 既存の setter 呼び出し (prev => ...) と互換のセッターを返す。
  const {
    loading: dataLoading,
    transactions, setTransactions,
    places, setPlaces,
    schedules, setSchedules,
    settings, setSettings,
  } = useCoupleAppData()

  const [modal, setModal] = useState(null)

  const monthTitle = `${viewYear}年 ${viewMonth + 1}月`

  const monthTransactions = useMemo(
    () => transactions.filter((t) => {
      const d = new Date(t.date)
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth
    }),
    [transactions, viewYear, viewMonth],
  )

  const monthSchedules = useMemo(
    () => schedules.filter((s) => {
      const d = new Date(s.date)
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth
    }).sort((a, b) => new Date(a.date) - new Date(b.date)),
    [schedules, viewYear, viewMonth],
  )

  const monthlyIncome = monthTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const monthlyExpense = monthTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const monthlyBalance = monthlyIncome - monthlyExpense

  const dayDotMap = useMemo(() => {
    const map = {}
    monthTransactions.forEach((t) => {
      const day = Number(t.date.slice(8))
      if (!map[day]) map[day] = { i: false, e: false, s: false }
      if (t.type === 'income') map[day].i = true
      if (t.type === 'expense') map[day].e = true
    })
    monthSchedules.forEach((s) => {
      const day = Number(s.date.slice(8))
      if (!map[day]) map[day] = { i: false, e: false, s: false }
      map[day].s = true
    })
    return map
  }, [monthTransactions, monthSchedules])

  const filteredPlaces = useMemo(
    () => places.filter((p) => placeFilter === 'all' || p.status === placeFilter),
    [places, placeFilter],
  )

  const calendarCells = useMemo(() => {
    const totalDays = getDays(viewYear, viewMonth)
    const startDow = firstDow(viewYear, viewMonth)
    const isCurrentMonth = viewYear === TODAY.getFullYear() && viewMonth === TODAY.getMonth()

    return [
      ...Array.from({ length: startDow }).map((_, idx) => ({ key: `empty-${idx}`, empty: true })),
      ...Array.from({ length: totalDays }).map((_, i) => {
        const day = i + 1
        const dow = (startDow + i) % 7
        return {
          key: day,
          day,
          dow,
          isToday: isCurrentMonth && day === TODAY.getDate(),
          dots: dayDotMap[day],
        }
      }),
    ]
  }, [viewYear, viewMonth, dayDotMap])

  const analysisData = useMemo(() => {
    const y = TODAY.getFullYear()
    const m = TODAY.getMonth()
    const d = TODAY.getDate()
    const pm = m === 0 ? 11 : m - 1
    const py = m === 0 ? y - 1 : y

    const thisTx = transactions.filter((t) => {
      const dt = new Date(t.date)
      return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() <= d
    })
    const lastTx = transactions.filter((t) => {
      const dt = new Date(t.date)
      return dt.getFullYear() === py && dt.getMonth() === pm && dt.getDate() <= d
    })

    const sum = (arr, type) => arr.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0)

    const thisIncome = sum(thisTx, 'income')
    const thisExpense = sum(thisTx, 'expense')
    const lastIncome = sum(lastTx, 'income')
    const lastExpense = sum(lastTx, 'expense')

    const cats = ['家賃', '食費', '外食', '交通費', '娯楽', '日用品']
    const catSum = (arr, cat) => arr.filter((t) => t.type === 'expense' && t.category === cat).reduce((s, t) => s + t.amount, 0)

    const chartData = cats.map((cat) => ({
      cat,
      this: catSum(thisTx, cat),
      last: catSum(lastTx, cat),
    }))

    const lineDays = getDays(y, m)
    const incomeDaily = Array(lineDays).fill(0)
    const expenseDaily = Array(lineDays).fill(0)
    thisTx.forEach((t) => {
      const index = new Date(t.date).getDate() - 1
      if (t.type === 'income') incomeDaily[index] += t.amount
      else expenseDaily[index] += t.amount
    })

    return {
      y,
      m,
      d,
      thisIncome,
      thisExpense,
      lastIncome,
      lastExpense,
      thisBalance: thisIncome - thisExpense,
      lastBalance: lastIncome - lastExpense,
      chartData,
      incomeDaily,
      expenseDaily,
    }
  }, [transactions])

  const openIncomeModal = (existing = null, defaultDate = null) => {
    setModal({
      type: 'transaction-form',
      txType: 'income',
      existing,
      defaultDate,
    })
  }

  const openExpenseModal = (existing = null, defaultDate = null) => {
    setModal({
      type: 'transaction-form',
      txType: 'expense',
      existing,
      defaultDate,
    })
  }

  const openScheduleModal = (existing = null, defaultDate = null) => {
    setModal({
      type: 'schedule-form',
      existing,
      defaultDate,
    })
  }

  const openPlaceModal = (existing = null, defaultTargetDate = null) => {
    setModal({
      type: 'place-form',
      existing,
      defaultTargetDate,
    })
  }

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((v) => v - 1)
      setViewMonth(11)
    } else {
      setViewMonth((v) => v - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((v) => v + 1)
      setViewMonth(0)
    } else {
      setViewMonth((v) => v + 1)
    }
  }

  const handleTransactionSubmit = (type, payload, existing) => {
    const now = nowIso()

    if (existing) {
      setTransactions((prev) =>
        prev.map((t) => (
          t.id === existing.id
            ? { ...t, ...payload, updatedAt: now }
            : t
        )),
      )
    } else {
      setTransactions((prev) => [
        ...prev,
        { id: genId(), type, ...payload, createdAt: now, updatedAt: now },
      ])
    }
    setModal(null)
  }

  const handleScheduleSubmit = (payload, existing) => {
    const now = nowIso()

    if (existing) {
      setSchedules((prev) =>
        prev.map((s) => (
          s.id === existing.id
            ? { ...s, ...payload, updatedAt: now }
            : s
        )),
      )
    } else {
      setSchedules((prev) => [
        ...prev,
        { id: genId(), ...payload, createdAt: now, updatedAt: now },
      ])
    }
    setModal(null)
  }

  const handlePlaceSubmit = (payload, existing) => {
    const now = nowIso()

    if (existing) {
      setPlaces((prev) =>
        prev.map((p) => (
          p.id === existing.id
            ? {
                ...p,
                name: payload.name,
                genre: payload.genre,
                targetDate: payload.targetDate,
                address: payload.address,
                memo: payload.memo,
                status: payload.status,
                images: payload.imageData ? [payload.imageData] : p.images,
                emoji: EMOJI_MAP[payload.genre] || '📍',
                updatedAt: now,
              }
            : p
        )),
      )
    } else {
      setPlaces((prev) => [
        ...prev,
        {
          id: genId(),
          name: payload.name,
          genre: payload.genre,
          targetDate: payload.targetDate,
          visitedDate: payload.status === 'visited' ? now : '',
          address: payload.address,
          memo: payload.memo,
          images: payload.imageData ? [payload.imageData] : [],
          emoji: EMOJI_MAP[payload.genre] || '📍',
          status: payload.status,
          createdAt: now,
          updatedAt: now,
        },
      ])
    }
    setModal(null)
  }

  const handleOpenDayModal = (day) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayTransactions = transactions.filter((t) => t.date === dateStr)
    const daySchedules = schedules.filter((s) => s.date === dateStr)
    const dayIncome = dayTransactions.filter((t) => t.type === 'income')
    const dayExpense = dayTransactions.filter((t) => t.type === 'expense')

    setModal({
      type: 'day-detail',
      dateStr,
      dayIncome,
      dayExpense,
      daySchedules,
    })
  }

  const openSummaryModal = () => {
    const expTx = monthTransactions.filter((t) => t.type === 'expense')
    const incTx = monthTransactions.filter((t) => t.type === 'income')

    const expMap = {}
    const incMap = {}

    expTx.forEach((t) => { expMap[t.category] = (expMap[t.category] || 0) + t.amount })
    incTx.forEach((t) => { incMap[t.category] = (incMap[t.category] || 0) + t.amount })

    setModal({
      type: 'summary',
      expRows: Object.entries(expMap).sort((a, b) => b[1] - a[1]),
      incRows: Object.entries(incMap).sort((a, b) => b[1] - a[1]),
    })
  }

  const openCategoryAddModal = (kind) => {
    const titleMap = {
      expense: '支出カテゴリーを追加',
      income: '収入カテゴリーを追加',
      genre: '場所ジャンルを追加',
      schedulecat: '予定カテゴリーを追加',
    }
    setModal({ type: 'category-form', kind, title: titleMap[kind] })
  }

  const openCategoryDetailModal = (kind, name) => {
    const titleMap = {
      expense: '支出カテゴリー',
      income: '収入カテゴリー',
      genre: '場所ジャンル',
      schedulecat: '予定カテゴリー',
    }
    setModal({ type: 'category-detail', kind, name, title: titleMap[kind] })
  }

  const addCategory = (kind, value) => {
    setSettings((prev) => {
      const next = { ...prev }
      if (kind === 'expense' && !next.expenseCategories.includes(value)) next.expenseCategories = [...next.expenseCategories, value]
      if (kind === 'income' && !next.incomeCategories.includes(value)) next.incomeCategories = [...next.incomeCategories, value]
      if (kind === 'genre' && !next.placeGenres.includes(value)) next.placeGenres = [...next.placeGenres, value]
      if (kind === 'schedulecat' && !next.scheduleCategories.includes(value)) next.scheduleCategories = [...next.scheduleCategories, value]
      return next
    })
    setModal(null)
  }

  const editCategory = (kind, oldName, newName) => {
    setSettings((prev) => {
      const next = { ...prev }
      const replace = (arr) => arr.map((v) => (v === oldName ? newName : v))
      if (kind === 'expense') next.expenseCategories = replace(prev.expenseCategories)
      if (kind === 'income') next.incomeCategories = replace(prev.incomeCategories)
      if (kind === 'genre') next.placeGenres = replace(prev.placeGenres)
      if (kind === 'schedulecat') next.scheduleCategories = replace(prev.scheduleCategories)
      return next
    })
    setModal(null)
  }

  const deleteCategory = (kind, name) => {
    setSettings((prev) => {
      const next = { ...prev }
      if (kind === 'expense') next.expenseCategories = prev.expenseCategories.filter((v) => v !== name)
      if (kind === 'income') next.incomeCategories = prev.incomeCategories.filter((v) => v !== name)
      if (kind === 'genre') next.placeGenres = prev.placeGenres.filter((v) => v !== name)
      if (kind === 'schedulecat') next.scheduleCategories = prev.scheduleCategories.filter((v) => v !== name)
      return next
    })
    setModal(null)
  }

  const renderLineChart = () => {
    const { incomeDaily, expenseDaily } = analysisData
    const days = incomeDaily.length
    const maxVal = Math.max(...incomeDaily, ...expenseDaily, 1)

    const w = 360
    const h = 180
    const left = 26
    const right = 8
    const top = 8
    const bottom = 24
    const cw = w - left - right
    const ch = h - top - bottom

    const x = (i) => left + (cw * i / Math.max(days - 1, 1))
    const y = (v) => top + ch - (v / maxVal) * ch
    const makePath = (arr) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(' ')
    const xLabels = [1, Math.max(1, Math.ceil(days / 2)), days].filter((v, i, a) => a.indexOf(v) === i)
    const yLabels = [0, Math.round(maxVal / 2), maxVal]

    return (
      <svg className="line-chart-svg" viewBox="0 0 360 180" preserveAspectRatio="none">
        <line className="line-axis" x1={left} y1={top} x2={left} y2={top + ch} />
        <line className="line-axis" x1={left} y1={top + ch} x2={left + cw} y2={top + ch} />

        {yLabels.map((v) => (
          <g key={v}>
            <line className="line-grid" x1={left} y1={y(v)} x2={left + cw} y2={y(v)} />
            <text className="line-y-label" x="2" y={y(v) + 3}>{Math.round(v / 1000)}k</text>
          </g>
        ))}

        {xLabels.map((v) => (
          <text key={v} className="line-x-label" x={x(v - 1)} y={h - 6} textAnchor="middle">
            {v}日
          </text>
        ))}

        <path className="line-income" d={makePath(incomeDaily)} />
        <path className="line-expense" d={makePath(expenseDaily)} />

        {incomeDaily.map((v, i) => (
          <circle key={`i-${i}`} className="line-point-income" cx={x(i)} cy={y(v)} r={v ? 2.8 : 0} />
        ))}
        {expenseDaily.map((v, i) => (
          <circle key={`e-${i}`} className="line-point-expense" cx={x(i)} cy={y(v)} r={v ? 2.8 : 0} />
        ))}
      </svg>
    )
  }

  if (dataLoading) {
    return (
      <div className="app-root">
        <div className="app-loading">読み込み中…</div>
      </div>
    )
  }

  return (
    <div className="app-root">
      <div className="app-frame">
        <button className="sign-out-btn" onClick={() => supabase.auth.signOut()} title="ログアウト">
          <span aria-hidden="true">⎋</span>
          <span className="sign-out-label">ログアウト</span>
        </button>
        <TopActionBar
          onAddIncome={() => openIncomeModal()}
          onAddExpense={() => openExpenseModal()}
          onAddSchedule={() => openScheduleModal()}
          onAddPlace={() => openPlaceModal()}
        />

        <div className="content-area">
          {activeTab === 'calendar' && (
            <div className="screen">
              <div className="cal-header">
                <button className="nav-btn" onClick={prevMonth}>‹</button>
                <h2 className="month-title">{monthTitle}</h2>
                <button className="nav-btn" onClick={nextMonth}>›</button>
              </div>

              <button className="expense-banner" onClick={openSummaryModal}>
                <div className="expense-banner-label">今月の支出合計 　タップで詳細 ›</div>
                <div className="expense-banner-amount">¥{fmtNum(monthlyExpense)}</div>
              </button>

              <div className="cal-box">
                <div className="cal-wdays">
                  <div className="cal-wday sun">日</div>
                  <div className="cal-wday">月</div>
                  <div className="cal-wday">火</div>
                  <div className="cal-wday">水</div>
                  <div className="cal-wday">木</div>
                  <div className="cal-wday">金</div>
                  <div className="cal-wday sat">土</div>
                </div>

                <div className="cal-grid">
                  {calendarCells.map((cell) => {
                    if (cell.empty) return <div key={cell.key} className="cal-cell empty" />

                    return (
                      <div
                        key={cell.key}
                        className={[
                          'cal-cell',
                          cell.isToday ? 'today' : '',
                          cell.dow === 0 ? 'sun' : '',
                          cell.dow === 6 ? 'sat' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => handleOpenDayModal(cell.day)}
                      >
                        <span className="cal-num">{cell.day}</span>
                        <div className="cal-dots">
                          {cell.dots?.i && <span className="dot dot-i" />}
                          {cell.dots?.e && <span className="dot dot-e" />}
                          {cell.dots?.s && <span className="dot dot-s" />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="inner-tabs">
                <button className={`inner-tab${innerTab === 'detail' ? ' active' : ''}`} onClick={() => setInnerTab('detail')}>
                  今月の明細
                </button>
                <button className={`inner-tab${innerTab === 'schedule' ? ' active' : ''}`} onClick={() => setInnerTab('schedule')}>
                  今月の予定
                </button>
              </div>

              {innerTab === 'detail' ? (
                <div className="section" style={{ marginTop: 12 }}>
                  <div className="tx-list">
                    {monthTransactions.length ? (
                      [...monthTransactions]
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .map((tx) => (
                          <div
                            className="tx-item"
                            key={tx.id}
                            onClick={() => setModal({ type: 'transaction-detail', tx })}
                          >
                            <div className="tx-left">
                              <span className={`tx-badge ${tx.type}`}>{tx.category}</span>
                              <span className="tx-memo">{tx.memo}</span>
                            </div>
                            <div className="tx-right">
                              <span className="tx-date">{tx.date.slice(5).replace('-', '/')}</span>
                              <span className={`tx-amount ${tx.type}`}>{tx.type === 'income' ? '+' : '−'}¥{fmtNum(tx.amount)}</span>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="empty-state"><p>この月の明細はありません</p></div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="section" style={{ marginTop: 12 }}>
                  <div className="sch-list">
                    {monthSchedules.length ? (
                      monthSchedules.map((s) => (
                        <div className="sch-item" key={s.id} onClick={() => setModal({ type: 'schedule-detail', schedule: s })}>
                          <div className="sch-dot" />
                          <div className="sch-body">
                            <div className="sch-title">{s.title}</div>
                            <div className="sch-cat">{s.category}</div>
                          </div>
                          <div className="sch-date-label">{s.date.slice(5).replace('-', '/')}</div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state"><p>この月の予定はありません</p></div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

          {activeTab === 'places' && (
            <div className="screen">
              <div className="screen-header">
                <h2 className="screen-title">行きたい場所</h2>
                <div className="filter-tabs">
                  <button className={`filter-tab${placeFilter === 'all' ? ' active' : ''}`} onClick={() => setPlaceFilter('all')}>すべて</button>
                  <button className={`filter-tab${placeFilter === 'want' ? ' active' : ''}`} onClick={() => setPlaceFilter('want')}>行きたい</button>
                  <button className={`filter-tab${placeFilter === 'visited' ? ' active' : ''}`} onClick={() => setPlaceFilter('visited')}>行った</button>
                </div>
              </div>

              <div className="places-grid">
                {filteredPlaces.length ? filteredPlaces.map((p) => (
                  <div
                    key={p.id}
                    className={`place-card${p.status === 'visited' ? ' visited' : ''}`}
                    onClick={() => setModal({ type: 'place-detail', place: p })}
                  >
                    <div className="place-thumb" style={{ background: GENRE_GRADIENT[p.genre] || '#eee' }}>
                      {p.images?.length ? <img src={p.images[0]} alt={p.name} loading="lazy" /> : <span className="place-emoji">{p.emoji || '📍'}</span>}
                      {p.status === 'visited' && <div className="visited-stamp">VISITED</div>}
                    </div>
                    <div className="place-body">
                      <span className="place-genre">{p.genre}</span>
                      <p className="place-name">{p.name}</p>
                      <p className="place-date">📅 {p.targetDate ? p.targetDate.replaceAll('-', '/') : '未設定'}</p>
                      <p className="place-addr">📍 {p.address || '未設定'}</p>
                    </div>
                  </div>
                )) : (
                  <div className="empty-state" style={{ gridColumn: '1 / -1' }}><p>表示する場所がありません</p></div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="screen">
              <div className="screen-header">
                <h2 className="screen-title">分析</h2>
                <p className="screen-sub">{analysisData.m + 1}月{analysisData.d}日時点 vs 先月同日比較</p>
              </div>

              <div className="compare-row">
                <div className="compare-card this-month">
                  <div className="cmp-label">今月</div>
                  <div className="cmp-income">収入 ¥{fmtNum(analysisData.thisIncome)}</div>
                  <div className="cmp-expense">支出 ¥{fmtNum(analysisData.thisExpense)}</div>
                  <div className={`cmp-balance ${analysisData.thisBalance >= 0 ? 'pos' : 'neg'}`}>
                    {analysisData.thisBalance >= 0 ? '+' : ''}¥{fmtNum(analysisData.thisBalance)}
                  </div>
                </div>
                <div className="vs-badge">VS</div>
                <div className="compare-card last-month">
                  <div className="cmp-label">先月</div>
                  <div className="cmp-income">収入 ¥{fmtNum(analysisData.lastIncome)}</div>
                  <div className="cmp-expense">支出 ¥{fmtNum(analysisData.lastExpense)}</div>
                  <div className={`cmp-balance ${analysisData.lastBalance >= 0 ? 'pos' : 'neg'}`}>
                    {analysisData.lastBalance >= 0 ? '+' : ''}¥{fmtNum(analysisData.lastBalance)}
                  </div>
                </div>
              </div>

              <div className="line-chart-wrap">
                <div className="chart-legend" style={{ marginBottom: 8 }}>
                  <span className="legend legend-this" style={{ color: 'var(--blue)' }}>■ 収入</span>
                  <span className="legend legend-last" style={{ color: 'var(--red)' }}>■ 支出</span>
                </div>
                {renderLineChart()}
              </div>

              <div className="section">
                <h3 className="sec-title">カテゴリ別支出</h3>
                <div className="chart-legend">
                  <span className="legend legend-this">■ 今月</span>
                  <span className="legend legend-last">■ 先月</span>
                </div>
                <div className="bar-chart">
                  {(() => {
                    const maxVal = Math.max(...analysisData.chartData.flatMap((r) => [r.this, r.last]), 1)
                    return analysisData.chartData.map((row) => (
                      <div className="bar-row" key={row.cat}>
                        <span className="bar-cat">{row.cat}</span>
                        <div className="bars">
                          <div className="bar-line">
                            <div className="bar bar-this" style={{ width: `${(row.this / maxVal) * 100}%` }} />
                            <span className="bar-val">¥{fmtNum(row.this)}</span>
                          </div>
                          <div className="bar-line">
                            <div className="bar bar-last" style={{ width: `${(row.last / maxVal) * 100}%` }} />
                            <span className="bar-val">¥{fmtNum(row.last)}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="screen">
              <div className="screen-header">
                <h2 className="screen-title">設定</h2>
              </div>

              <div className="section">
                <h3 className="sec-title">支出カテゴリー</h3>
                <div className="pill-wrap">
                  {settings.expenseCategories.map((c) => (
                    <span key={c} className="pill pill-cat" onClick={() => openCategoryDetailModal('expense', c)}>{c}</span>
                  ))}
                </div>
                <button className="add-cat-btn" onClick={() => openCategoryAddModal('expense')}>＋ 追加</button>
              </div>

              <div className="section">
                <h3 className="sec-title">収入カテゴリー</h3>
                <div className="pill-wrap">
                  {settings.incomeCategories.map((c) => (
                    <span key={c} className="pill pill-income-cat" onClick={() => openCategoryDetailModal('income', c)}>{c}</span>
                  ))}
                </div>
                <button className="add-cat-btn" onClick={() => openCategoryAddModal('income')}>＋ 追加</button>
              </div>

              <div className="section">
                <h3 className="sec-title">場所ジャンル</h3>
                <div className="pill-wrap">
                  {settings.placeGenres.map((g) => (
                    <span key={g} className="pill pill-genre" onClick={() => openCategoryDetailModal('genre', g)}>{g}</span>
                  ))}
                </div>
                <button className="add-cat-btn" onClick={() => openCategoryAddModal('genre')}>＋ 追加</button>
              </div>

              <div className="section">
                <h3 className="sec-title">予定カテゴリー</h3>
                <div className="pill-wrap">
                  {settings.scheduleCategories.map((c) => (
                    <span key={c} className="pill pill-sch-cat" onClick={() => openCategoryDetailModal('schedulecat', c)}>{c}</span>
                  ))}
                </div>
                <button className="add-cat-btn" onClick={() => openCategoryAddModal('schedulecat')}>＋ 追加</button>
              </div>

              <div className="section">
                <h3 className="sec-title">ペア設定</h3>
                <div className="pair-card">
                  <div className="pair-member"><div className="avatar">👤</div><span>あなた</span></div>
                  <div className="pair-heart">💕</div>
                  <div className="pair-member"><div className="avatar">👤</div><span>パートナー</span></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <TabBar active={activeTab} onSelect={setActiveTab} />

        {modal?.type === 'transaction-form' && (
          <TransactionFormModal
            type={modal.txType}
            categories={modal.txType === 'income' ? settings.incomeCategories : settings.expenseCategories}
            existing={modal.existing}
            defaultDate={modal.defaultDate}
            onClose={() => setModal(null)}
            onSubmit={(payload) => handleTransactionSubmit(modal.txType, payload, modal.existing)}
          />
        )}

        {modal?.type === 'schedule-form' && (
          <ScheduleFormModal
            categories={settings.scheduleCategories}
            existing={modal.existing}
            defaultDate={modal.defaultDate}
            onClose={() => setModal(null)}
            onSubmit={(payload) => handleScheduleSubmit(payload, modal.existing)}
          />
        )}

        {modal?.type === 'place-form' && (
          <PlaceFormModal
            genres={settings.placeGenres}
            existing={modal.existing}
            defaultTargetDate={modal.defaultTargetDate}
            onClose={() => setModal(null)}
            onSubmit={(payload) => handlePlaceSubmit(payload, modal.existing)}
          />
        )}

        {modal?.type === 'transaction-detail' && (
          <TransactionDetailModal
            tx={modal.tx}
            onClose={() => setModal(null)}
            onEdit={() => openIncomeModal(
              modal.tx.type === 'income' ? modal.tx : null,
              null,
            ) || (modal.tx.type === 'expense' && openExpenseModal(modal.tx))}
            onDelete={() => setModal({
              type: 'confirm',
              title: '明細を削除',
              message: `「${modal.tx.memo || modal.tx.category}」を削除しますか？\nこの操作は取り消せません。`,
              onConfirm: () => {
                setTransactions((prev) => prev.filter((t) => t.id !== modal.tx.id))
                setModal(null)
              },
            })}
          />
        )}

        {modal?.type === 'schedule-detail' && (
          <ScheduleDetailModal
            schedule={modal.schedule}
            onClose={() => setModal(null)}
            onEdit={() => openScheduleModal(modal.schedule)}
            onDelete={() => setModal({
              type: 'confirm',
              title: '予定を削除',
              message: `「${modal.schedule.title}」を削除しますか？`,
              onConfirm: () => {
                setSchedules((prev) => prev.filter((s) => s.id !== modal.schedule.id))
                setModal(null)
              },
            })}
          />
        )}

        {modal?.type === 'place-detail' && (
          <PlaceDetailModal
            place={modal.place}
            onClose={() => setModal(null)}
            onEdit={() => openPlaceModal(modal.place)}
            onDelete={() => setModal({
              type: 'confirm',
              title: '場所を削除',
              message: `「${modal.place.name}」を削除しますか？`,
              onConfirm: () => {
                setPlaces((prev) => prev.filter((p) => p.id !== modal.place.id))
                setModal(null)
              },
            })}
            onStampVisited={() => {
              setPlaces((prev) => prev.map((p) => (
                p.id === modal.place.id
                  ? { ...p, status: 'visited', visitedDate: TODAY.toISOString().slice(0, 10), updatedAt: nowIso() }
                  : p
              )))
              setModal(null)
            }}
          />
        )}

        {modal?.type === 'day-detail' && (
          <DayDetailModal
            dateStr={modal.dateStr}
            dayIncome={modal.dayIncome}
            dayExpense={modal.dayExpense}
            daySchedules={modal.daySchedules}
            onClose={() => setModal(null)}
            onAddIncome={() => openIncomeModal(null, modal.dateStr)}
            onAddExpense={() => openExpenseModal(null, modal.dateStr)}
            onAddSchedule={() => openScheduleModal(null, modal.dateStr)}
            onAddPlace={() => openPlaceModal(null, modal.dateStr)}
          />
        )}

        {modal?.type === 'summary' && (
          <Modal onClose={() => setModal(null)}>
            <h3 className="modal-title">{viewYear}年{viewMonth + 1}月 月次サマリー</h3>

            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <div style={{ flex: 1, background: 'var(--green-light)', borderRadius: 'var(--r-m)', padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>収入合計</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>¥{fmtNum(monthlyIncome)}</div>
              </div>
              <div style={{ flex: 1, background: 'var(--amber-light)', borderRadius: 'var(--r-m)', padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber)', marginBottom: 4 }}>支出合計</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--amber)' }}>¥{fmtNum(monthlyExpense)}</div>
              </div>
              <div style={{ flex: 1, background: monthlyBalance >= 0 ? 'var(--green-light)' : '#FFEEEE', borderRadius: 'var(--r-m)', padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: monthlyBalance >= 0 ? 'var(--green)' : 'var(--red)', marginBottom: 4 }}>収支</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: monthlyBalance >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {monthlyBalance >= 0 ? '+' : ''}¥{fmtNum(monthlyBalance)}
                </div>
              </div>
            </div>

            <div className="day-section-title">🌸 支出 カテゴリー別</div>
            {modal.expRows.length ? modal.expRows.map(([cat, amt]) => {
              const maxCat = modal.expRows[0][1]
              return (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-2)', width: 56, flexShrink: 0 }}>{cat}</span>
                  <div style={{ flex: 1, background: 'var(--border)', borderRadius: 6, height: 12, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(amt / maxCat) * 100}%`, background: 'linear-gradient(90deg,var(--pink),var(--pink-deep))', borderRadius: 6 }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>¥{fmtNum(amt)}</span>
                </div>
              )
            }) : <p className="day-empty-text">支出データがありません</p>}

            <div className="day-section-title">💚 収入 カテゴリー別</div>
            {modal.incRows.length ? modal.incRows.map(([cat, amt]) => {
              const maxCat = modal.incRows[0][1]
              return (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-2)', width: 56, flexShrink: 0 }}>{cat}</span>
                  <div style={{ flex: 1, background: 'var(--border)', borderRadius: 6, height: 12, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(amt / maxCat) * 100}%`, background: 'linear-gradient(90deg,var(--green),#3a9e72)', borderRadius: 6 }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>¥{fmtNum(amt)}</span>
                </div>
              )
            }) : <p className="day-empty-text">収入データがありません</p>}

            <button className="btn-close-full" onClick={() => setModal(null)}>閉じる</button>
          </Modal>
        )}

        {modal?.type === 'category-form' && (
          <CategoryFormModal
            title={modal.title}
            onClose={() => setModal(null)}
            onSubmit={(value) => {
              if (modal.name) editCategory(modal.kind, modal.name, value)
              else addCategory(modal.kind, value)
            }}
            initialValue={modal.name || ''}
          />
        )}

        {modal?.type === 'category-detail' && (
          <CategoryDetailModal
            title={modal.title}
            name={modal.name}
            onClose={() => setModal(null)}
            onEdit={() => setModal({
              type: 'category-form',
              kind: modal.kind,
              title: `${modal.title}を編集`,
              name: modal.name,
            })}
            onDelete={() => setModal({
              type: 'confirm',
              title: '削除の確認',
              message: `「${modal.name}」を削除しますか？`,
              onConfirm: () => deleteCategory(modal.kind, modal.name),
            })}
          />
        )}

        {modal?.type === 'confirm' && (
          <ConfirmModal
            title={modal.title}
            message={modal.message}
            onCancel={() => setModal(null)}
            onConfirm={modal.onConfirm}
          />
        )}
      </div>
    </div>
  )
}