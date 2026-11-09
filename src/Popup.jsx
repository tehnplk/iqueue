import { useEffect } from 'react'
import { X } from 'lucide-react'
import { MOCK_DX, MOCK_LAB, MOCK_RX } from './mock.js'

const VIEWS = {
  dx: {
    title: 'การวินิจฉัย (Dx)',
    rows: MOCK_DX,
    head: (
      <tr>
        <th>ICD-10</th>
        <th>ชื่อโรค</th>
        <th>ประเภท</th>
      </tr>
    ),
    row: (d) => (
      <tr key={d.code}>
        <td className="ticket">{d.code}</td>
        <td>{d.name}</td>
        <td className="muted">{d.type}</td>
      </tr>
    ),
  },
  rx: {
    title: 'รายการยา (Rx)',
    rows: MOCK_RX,
    head: (
      <tr>
        <th>ชื่อยา / วิธีใช้</th>
        <th className="num">จำนวน</th>
      </tr>
    ),
    row: (r) => (
      <tr key={r.name}>
        <td>
          <div>{r.name}</div>
          <div className="muted small">{r.usage}</div>
        </td>
        <td className="num">
          {r.qty} {r.unit}
        </td>
      </tr>
    ),
  },
  lab: {
    title: 'ผลแล็บ (Lab)',
    rows: MOCK_LAB,
    head: (
      <tr>
        <th>รายการ</th>
        <th className="num">ผล</th>
        <th>หน่วย</th>
        <th>ค่าปกติ</th>
      </tr>
    ),
    row: (l) => (
      <tr key={l.name}>
        <td>{l.name}</td>
        <td className={`num${l.flag ? ' warn' : ''}`}>
          {l.result} {l.flag && <span className="flag">{l.flag}</span>}
        </td>
        <td className="muted">{l.unit}</td>
        <td className="muted">{l.range}</td>
      </tr>
    ),
  },
}

// Dx / Rx / Lab modal: its own window, centered on screen.
export default function Popup({ kind }) {
  const view = VIEWS[kind]
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && window.close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="modal popup">
      <header className="modal-head">
        <h1>{view.title}</h1>
        <span className="muted">{view.rows.length} รายการ</span>
        <button className="icon-btn close" title="ปิด" aria-label="ปิด" onClick={() => window.close()}>
          <X size={16} />
        </button>
      </header>
      <div className="table-wrap">
        <table>
          <thead>{view.head}</thead>
          <tbody>{view.rows.map(view.row)}</tbody>
        </table>
      </div>
    </div>
  )
}
