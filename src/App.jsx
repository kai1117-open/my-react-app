import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import Login from './components/Login'
import { useAuth } from './hooks/useAuth'
import { useCoupleAppData } from './hooks/useCoupleAppData'
import { supabase } from './lib/supabase'

const pad2 = (n) => String(n).padStart(2, '0')
const getLocalDateString = (date = new Date()) => (
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
)
const parseLocalDateString = (dateStr) => {
  const [year, month, day] = String(dateStr || '').split('-').map(Number)
  return new Date(year || 1970, (month || 1) - 1, day || 1)
}
const getToday = () => new Date()

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

const fmtNum = (n) => Number(n).toLocaleString('ja-JP')
const getDays = (y, m) => new Date(y, m + 1, 0).getDate()
const firstDow = (y, m) => new Date(y, m, 1).getDay()
const nowIso = () => getLocalDateString()
const genId = () => Date.now() + Math.floor(Math.random() * 1000)
const isSameMonthString = (dateStr, year, month) => {
  const d = parseLocalDateString(dateStr)
  return d.getFullYear() === year && d.getMonth() === month
}
const getPreviousMonth = (year, month) => (
  month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
)
const isSameMonth = (year, month, baseYear, baseMonth) => year === baseYear && month === baseMonth
const getAnalysisEndDay = (year, month, today = getToday()) => {
  if (isSameMonth(year, month, today.getFullYear(), today.getMonth())) return today.getDate()
  return getDays(year, month)
}
const calcRate = (current, previous) => {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}
const formatRate = (rate) => (rate === null ? '新規' : `${rate >= 0 ? '+' : ''}${rate.toFixed(1)}%`)
const formatPeriodLabel = (label, year, startMonth, endDay) => (
  `${label}: ${year}年${startMonth + 1}月1日〜${startMonth + 1}月${endDay}日`
)
const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g
const renderTextWithLinks = (text) => {
  if (!text) return '—'
  const parts = String(text).split(URL_PATTERN)
  return parts.map((part, index) => {
    if (!/^https?:\/\//.test(part)) return part
    return (
      <a
        className="text-link"
        href={part}
        target="_blank"
        rel="noreferrer"
        key={`${part}-${index}`}
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    )
  })
}

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

function TopActionBar({ onAddIncome, onAddExpense }) {
  return (
    <div className="top-action-bar">
      <button className="top-btn top-btn-income" onClick={onAddIncome}>収入</button>
      <button className="top-btn top-btn-expense" onClick={onAddExpense}>支出</button>
    </div>
  )
}

function TransactionFormModal({ type, categories, existing, defaultDate, onClose, onSubmit }) {
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [category, setCategory] = useState(existing ? existing.category : categories[0] || '')
  const [date, setDate] = useState(existing ? existing.date : defaultDate || getLocalDateString())
  const [memo, setMemo] = useState(existing ? existing.memo : '')
  const [errors, setErrors] = useState({})
  const title = type === 'income' ? '💚 収入を追加' : '🌸 支出を追加'

  const handleSubmit = () => {
    const nextErrors = {}
    const amountNum = Number(amount)

    if (!amount || Number.isNaN(amountNum) || amountNum <= 0) nextErrors.amount = '金額は1円以上で入力してください'
    if (!category) nextErrors.category = 'カテゴリーを選択してください'
    if (!date) nextErrors.date = '日付を選択してください'
    if (!memo.trim()) nextErrors.memo = 'タイトルまたはメモを入力してください'

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    onSubmit({
      amount: Math.floor(amountNum),
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
  const [date, setDate] = useState(existing ? existing.date : defaultDate || getLocalDateString())
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
      <div className="detail-row"><span className="detail-label">メモ</span><span className="detail-value">{renderTextWithLinks(tx.memo)}</span></div>
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
      <div className="detail-row"><span className="detail-label">メモ</span><span className="detail-value">{renderTextWithLinks(schedule.memo)}</span></div>
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
      <div className="detail-row"><span className="detail-label">住所</span><span className="detail-value">{renderTextWithLinks(place.address)}</span></div>
      <div className="detail-row"><span className="detail-label">メモ</span><span className="detail-value">{renderTextWithLinks(place.memo)}</span></div>

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

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className="toast">
      <div className="toast-title">{toast.title}</div>
      {toast.message && <div className="toast-message">{toast.message}</div>}
    </div>
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
}) {
  const txItemHtml = (arr, type) => (
    arr.length ? (
      arr.map((t) => (
        <div className="day-tx-item" key={t.id}>
          <div>
            <span className={`day-tx-cat ${type}`}>{t.category}</span>
            <div className="day-tx-memo">{renderTextWithLinks(t.memo)}</div>
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
        <button className="day-action-btn income" onClick={onAddIncome}>収入を追加</button>
        <button className="day-action-btn expense" onClick={onAddExpense}>支出を追加</button>
        <button className="day-action-btn schedule" onClick={onAddSchedule}>予定を追加</button>
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
              {s.memo && <div className="day-tx-note">{renderTextWithLinks(s.memo)}</div>}
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
  const today = getToday()
  const [activeTab, setActiveTab] = useState('calendar')
  const [innerTab, setInnerTab] = useState('detail')
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
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
  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
  }, [])

  const showToast = (title, message = '') => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    setToast({ title, message })
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1500)
  }

  const monthTitle = `${viewYear}年 ${viewMonth + 1}月`

  const monthTransactions = useMemo(
    () => transactions.filter((t) => isSameMonthString(t.date, viewYear, viewMonth)),
    [transactions, viewYear, viewMonth],
  )

  const monthSchedules = useMemo(
    () => schedules
      .filter((s) => isSameMonthString(s.date, viewYear, viewMonth))
      .sort((a, b) => parseLocalDateString(a.date) - parseLocalDateString(b.date)),
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
    const todayDate = getToday()
    const isCurrentMonth = viewYear === todayDate.getFullYear() && viewMonth === todayDate.getMonth()

    return [
      ...Array.from({ length: startDow }).map((_, idx) => ({ key: `empty-${idx}`, empty: true })),
      ...Array.from({ length: totalDays }).map((_, i) => {
        const day = i + 1
        const dow = (startDow + i) % 7
        return {
          key: day,
          day,
          dow,
          isToday: isCurrentMonth && day === todayDate.getDate(),
          dots: dayDotMap[day],
        }
      }),
    ]
  }, [viewYear, viewMonth, dayDotMap])

  const analysisData = useMemo(() => {
    const todayDate = getToday()
    const y = viewYear
    const m = viewMonth
    const periodEndDay = getAnalysisEndDay(y, m, todayDate)
    const { year: py, month: pm } = getPreviousMonth(y, m)
    const lastPeriodEndDay = Math.min(periodEndDay, getDays(py, pm))
    const currentLabel = isSameMonth(y, m, todayDate.getFullYear(), todayDate.getMonth()) ? '今月' : `${y}年${m + 1}月`
    const previousLabel = '先月'

    const filterPeriod = (arr, year, month, endDay) => arr.filter((t) => {
      const dt = parseLocalDateString(t.date)
      return dt.getFullYear() === year && dt.getMonth() === month && dt.getDate() <= endDay
    })

    const thisTx = filterPeriod(transactions, y, m, periodEndDay)
    const lastTx = filterPeriod(transactions, py, pm, lastPeriodEndDay)

    const sum = (arr, type) => arr
      .filter((t) => t.type === type)
      .reduce((s, t) => s + Number(t.amount || 0), 0)

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

    const buildCumulative = (arr, year, month, days) => {
      const incomeDaily = Array(days).fill(0)
      const expenseDaily = Array(days).fill(0)
      arr.forEach((t) => {
        const dt = parseLocalDateString(t.date)
        if (dt.getFullYear() !== year || dt.getMonth() !== month) return
        const index = dt.getDate() - 1
        if (index < 0 || index >= days) return
        if (t.type === 'income') incomeDaily[index] += Number(t.amount || 0)
        if (t.type === 'expense') expenseDaily[index] += Number(t.amount || 0)
      })

      let income = 0
      let expense = 0
      return Array.from({ length: days }).map((_, index) => {
        income += incomeDaily[index]
        expense += expenseDaily[index]
        return {
          day: index + 1,
          income,
          expense,
          balance: income - expense,
        }
      })
    }

    const thisCumulative = buildCumulative(thisTx, y, m, periodEndDay)
    const lastCumulative = buildCumulative(lastTx, py, pm, lastPeriodEndDay)
    const comparisonRows = [
      {
        key: 'income',
        label: '収入',
        current: thisIncome,
        previous: lastIncome,
        diff: thisIncome - lastIncome,
        rate: calcRate(thisIncome, lastIncome),
      },
      {
        key: 'expense',
        label: '支出',
        current: thisExpense,
        previous: lastExpense,
        diff: thisExpense - lastExpense,
        rate: calcRate(thisExpense, lastExpense),
      },
      {
        key: 'balance',
        label: '収支差',
        current: thisIncome - thisExpense,
        previous: lastIncome - lastExpense,
        diff: (thisIncome - thisExpense) - (lastIncome - lastExpense),
        rate: calcRate(thisIncome - thisExpense, lastIncome - lastExpense),
      },
    ]

    return {
      y,
      m,
      d: periodEndDay,
      py,
      pm,
      lastD: lastPeriodEndDay,
      currentLabel,
      previousLabel,
      currentPeriodLabel: formatPeriodLabel(currentLabel, y, m, periodEndDay),
      previousPeriodLabel: formatPeriodLabel(previousLabel, py, pm, lastPeriodEndDay),
      thisIncome,
      thisExpense,
      lastIncome,
      lastExpense,
      thisBalance: thisIncome - thisExpense,
      lastBalance: lastIncome - lastExpense,
      chartData,
      thisCumulative,
      lastCumulative,
      comparisonRows,
    }
  }, [transactions, viewYear, viewMonth])

  const openIncomeModal = (existing = null, defaultDate = null) => {
    setModal({
      type: 'transaction-form',
      txType: 'income',
      existing,
      defaultDate: existing ? existing.date : defaultDate || getLocalDateString(),
    })
  }

  const openExpenseModal = (existing = null, defaultDate = null) => {
    setModal({
      type: 'transaction-form',
      txType: 'expense',
      existing,
      defaultDate: existing ? existing.date : defaultDate || getLocalDateString(),
    })
  }

  const openScheduleModal = (existing = null, defaultDate = null) => {
    setModal({
      type: 'schedule-form',
      existing,
      defaultDate: existing ? existing.date : defaultDate || getLocalDateString(),
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
    const label = type === 'income' ? '収入' : '支出'

    if (existing) {
      setTransactions((prev) =>
        prev.map((t) => (
          t.id === existing.id
            ? { ...t, ...payload, updatedAt: now }
            : t
        )),
      )
      showToast(`${label}を更新しました`, `${payload.memo} ${fmtNum(payload.amount)}円`)
    } else {
      setTransactions((prev) => [
        ...prev,
        { id: genId(), type, ...payload, createdAt: now, updatedAt: now },
      ])
      showToast(`${label}を登録しました`, `${payload.memo} ${fmtNum(payload.amount)}円`)
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
      showToast('予定を更新しました', payload.title)
    } else {
      setSchedules((prev) => [
        ...prev,
        { id: genId(), ...payload, createdAt: now, updatedAt: now },
      ])
      showToast('予定を登録しました', payload.title)
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
      showToast('行きたい場所を更新しました', payload.name)
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
      showToast('行きたい場所を登録しました', payload.name)
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
    const { thisCumulative, lastCumulative } = analysisData
    const days = Math.max(thisCumulative.length, lastCumulative.length, 1)
    const series = [
      { key: 'thisIncome', values: thisCumulative.map((r) => r.income), cls: 'line-income line-current' },
      { key: 'lastIncome', values: lastCumulative.map((r) => r.income), cls: 'line-income line-previous' },
      { key: 'thisExpense', values: thisCumulative.map((r) => r.expense), cls: 'line-expense line-current' },
      { key: 'lastExpense', values: lastCumulative.map((r) => r.expense), cls: 'line-expense line-previous' },
      { key: 'thisBalance', values: thisCumulative.map((r) => r.balance), cls: 'line-balance line-current' },
      { key: 'lastBalance', values: lastCumulative.map((r) => r.balance), cls: 'line-balance line-previous' },
    ]
    const allValues = series.flatMap((s) => s.values)
    const minVal = Math.min(...allValues, 0)
    const maxVal = Math.max(...allValues, 1)
    const range = maxVal - minVal || 1

    const w = 360
    const h = 180
    const left = 34
    const right = 8
    const top = 8
    const bottom = 24
    const cw = w - left - right
    const ch = h - top - bottom

    const x = (i) => left + (cw * i / Math.max(days - 1, 1))
    const y = (v) => top + ch - ((v - minVal) / range) * ch
    const makePath = (arr) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(' ')
    const xLabels = [1, Math.max(1, Math.ceil(days / 2)), days].filter((v, i, a) => a.indexOf(v) === i)
    const yLabels = [minVal, Math.round((minVal + maxVal) / 2), maxVal].filter((v, i, a) => a.indexOf(v) === i)

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

        {series.map((s) => (
          <path key={s.key} className={s.cls} d={makePath(s.values)} />
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
          onAddIncome={() => openIncomeModal(null, getLocalDateString())}
          onAddExpense={() => openExpenseModal(null, getLocalDateString())}
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
                <div className="expense-banner-label">今月の支出合計 タップで詳細 ›</div>
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
                        .sort((a, b) => parseLocalDateString(b.date) - parseLocalDateString(a.date))
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
                  <button className="schedule-add-btn" onClick={() => openScheduleModal(null, getLocalDateString())}>
                    予定を追加
                  </button>
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
                <button className="place-add-btn" onClick={() => openPlaceModal()}>
                  行きたい場所を追加
                </button>
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
                <p className="screen-sub">
                  {analysisData.currentPeriodLabel} vs {analysisData.previousPeriodLabel}
                </p>
              </div>

              <div className="analysis-summary-grid">
                {analysisData.comparisonRows.map((row) => (
                  <div className={`analysis-card ${row.key}`} key={row.key}>
                    <div className="analysis-card-title">{row.label}</div>
                    <div className="analysis-card-line">
                      <span>{analysisData.currentLabel}</span>
                      <strong>¥{fmtNum(row.current)}</strong>
                    </div>
                    <div className="analysis-card-line muted">
                      <span>{analysisData.previousLabel}同期間</span>
                      <strong>¥{fmtNum(row.previous)}</strong>
                    </div>
                    <div className={`analysis-card-diff ${row.diff >= 0 ? 'pos' : 'neg'}`}>
                      <span>差額</span>
                      <strong>{row.diff >= 0 ? '+' : ''}¥{fmtNum(row.diff)}</strong>
                    </div>
                    <div className="analysis-card-rate">増減率 {formatRate(row.rate)}</div>
                  </div>
                ))}
              </div>

              <div className="line-chart-wrap">
                <h3 className="sec-title">日別の累積推移</h3>
                <div className="chart-legend cumulative-legend">
                  <span className="legend legend-income-current">■ 今月の累積収入</span>
                  <span className="legend legend-income-last">■ 先月の累積収入</span>
                  <span className="legend legend-expense-current">■ 今月の累積支出</span>
                  <span className="legend legend-expense-last">■ 先月の累積支出</span>
                  <span className="legend legend-balance-current">■ 今月の累積収支差</span>
                  <span className="legend legend-balance-last">■ 先月の累積収支差</span>
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
            onEdit={() => (
              modal.tx.type === 'income'
                ? openIncomeModal(modal.tx)
                : openExpenseModal(modal.tx)
            )}
            onDelete={() => setModal({
              type: 'confirm',
              title: '明細を削除',
              message: `「${modal.tx.memo || modal.tx.category}」を削除しますか？\nこの操作は取り消せません。`,
              onConfirm: () => {
                setTransactions((prev) => prev.filter((t) => t.id !== modal.tx.id))
                showToast('明細を削除しました', modal.tx.memo || modal.tx.category)
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
                showToast('予定を削除しました', modal.schedule.title)
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
                showToast('行きたい場所を削除しました', modal.place.name)
                setModal(null)
              },
            })}
            onStampVisited={() => {
              setPlaces((prev) => prev.map((p) => (
                p.id === modal.place.id
                  ? { ...p, status: 'visited', visitedDate: getLocalDateString(), updatedAt: nowIso() }
                  : p
              )))
              showToast('行った場所にしました', modal.place.name)
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
        <Toast toast={toast} />
      </div>
    </div>
  )
}
