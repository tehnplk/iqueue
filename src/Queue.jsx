import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Forward, Search, Volume2, X } from 'lucide-react'
import useCallCooldown from './useCallCooldown.js'

// Mock-up data (50 visits today). Swap for a DB query (ovst + kskdepartment) later.
const FIRST = ['สมชาย', 'สมหญิง', 'ประเสริฐ', 'วิไล', 'สุนีย์', 'อำนาจ', 'มาลี', 'ธีรพงษ์', 'กาญจนา', 'บุญมี']
const LAST = ['ใจดี', 'ศรีสุข', 'มั่นคง', 'แก้วมณี', 'บุญเรือง', 'ทองดี', 'สายสุข', 'พรหมมา']
const DEPTS = ['คัดกรอง', 'ห้องตรวจโรค 1', 'ห้องตรวจโรค 7', 'ห้องฉีดยา', 'ทันตกรรม', 'แพทย์แผนไทย']
const now = Date.now()
const MOCK = Array.from({ length: 50 }, (_, i) => ({
  ticket: `A${String(i + 1).padStart(3, '0')}`,
  qn: String(i + 1).padStart(3, '0'),
  hn: String(100 + i * 7).padStart(9, '0'),
  fullname: `${i % 2 ? 'นาง' : 'นาย'}${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`,
  dept: DEPTS[(i * 5) % DEPTS.length],
  arrived: new Date(now - (50 - i) * 4 * 60_000),
}))

const PAGE_SIZE = 10
const fmt = (d) => d.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// Refer a visit to another room. Native <dialog>: Esc and focus trapping come free.
function ForwardDialog({ row, onCancel, onConfirm }) {
  const ref = useRef(null)
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  useEffect(() => ref.current.showModal(), [])

  return (
    <dialog ref={ref} className="dialog" onCancel={onCancel}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault()
          onConfirm(to, note)
        }}
      >
        <header className="dialog-head">
          <h2>ส่งต่อ</h2>
          <button type="button" className="icon-btn" aria-label="ปิด" onClick={onCancel}>
            <X size={16} />
          </button>
        </header>
        <dl className="dialog-info">
          <dt>คิว</dt>
          <dd className="ticket">{row.ticket}</dd>
          <dt>HN</dt>
          <dd>{row.hn}</dd>
          <dt>ชื่อ-สกุล</dt>
          <dd>{row.fullname}</dd>
          <dt>แผนกปัจจุบัน</dt>
          <dd>{row.dept}</dd>
        </dl>
        <label className="field">
          ส่งต่อไปที่ห้อง
          <select required autoFocus value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="" disabled>
              — เลือกห้อง —
            </option>
            {DEPTS.filter((d) => d !== row.dept).map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="field">
          หมายเหตุ
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <footer className="dialog-foot">
          <button type="button" className="ghost-btn" onClick={onCancel}>
            ยกเลิก
          </button>
          <button type="submit" className="text-btn">
            <Forward size={13} /> ส่งต่อ
          </button>
        </footer>
      </form>
    </dialog>
  )
}

export default function Queue() {
  const [nowMs, setNow] = useState(Date.now())
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState(MOCK)
  const [forwarding, setForwarding] = useState(null)
  const cooling = useCallCooldown()

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    // Esc closes the window, unless a dialog is open (the dialog handles its own Esc).
    const onKey = (e) => e.key === 'Escape' && !document.querySelector('dialog[open]') && window.close()
    window.addEventListener('keydown', onKey)
    return () => {
      clearInterval(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const rows = useMemo(() => {
    const q = query.trim()
    return q ? list.filter((r) => r.ticket.toLowerCase().includes(q.toLowerCase()) || r.qn.includes(q) || r.hn.includes(q) || r.fullname.includes(q)) : list
  }, [query, list])
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const offset = (current - 1) * PAGE_SIZE

  return (
    <div className="modal">
      <header className="modal-head">
        <h1>รายการคิว</h1>
        <span className="muted">{rows.length} คน</span>
        <label className="search">
          <Search size={14} />
          <input
            autoFocus
            placeholder="ค้นหา คิว, QN, HN, ชื่อ"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
          />
        </label>
        <button className="icon-btn close" title="ปิด" aria-label="ปิด" onClick={() => window.close()}>
          <X size={16} />
        </button>
      </header>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="num">ลำดับ</th>
              <th>คิว</th>
              <th>วันเวลามา</th>
              <th>แผนกที่มา</th>
              <th>QN</th>
              <th>HN</th>
              <th>ชื่อ-สกุล</th>
              <th className="num">รอมาแล้ว (นาที)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(offset, offset + PAGE_SIZE).map((r, i) => {
              const wait = Math.floor((nowMs - r.arrived) / 60_000)
              return (
                <tr key={r.hn}>
                  <td className="num">{offset + i + 1}</td>
                  <td className="ticket">{r.ticket}</td>
                  <td>{fmt(r.arrived)}</td>
                  <td>{r.dept}</td>
                  <td className="mono">{r.qn}</td>
                  <td className="mono">{r.hn}</td>
                  <td>{r.fullname}</td>
                  <td className={`num${wait >= 60 ? ' warn' : ''}`}>{wait}</td>
                  <td className="row-actions">
                    <button className="text-btn" disabled={cooling} onClick={() => window.bar.callQueue()}>
                      <Volume2 size={13} /> เรียก
                    </button>
                    <button className="ghost-btn" onClick={() => setForwarding(r)}>
                      <Forward size={13} /> ส่งต่อ
                    </button>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="empty">
                  ไม่พบคิวที่ตรงกับ “{query}”
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="pager">
        <button className="icon-btn" aria-label="หน้าก่อน" disabled={current === 1} onClick={() => setPage(current - 1)}>
          <ChevronLeft size={16} />
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
          <button key={p} className={`page${p === current ? ' active' : ''}`} onClick={() => setPage(p)}>
            {p}
          </button>
        ))}
        <button className="icon-btn" aria-label="หน้าถัดไป" disabled={current === pages} onClick={() => setPage(current + 1)}>
          <ChevronRight size={16} />
        </button>
      </footer>

      {forwarding && (
        <ForwardDialog
          row={forwarding}
          onCancel={() => setForwarding(null)}
          onConfirm={(to) => {
            // Mock: move the visit locally. Real version writes ovst.cur_dep.
            setList((l) => l.map((r) => (r.hn === forwarding.hn ? { ...r, dept: to } : r)))
            setForwarding(null)
          }}
        />
      )}
    </div>
  )
}
