import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Settings, Users, Volume2 } from 'lucide-react'
import Queue from './Queue.jsx'
import Popup from './Popup.jsx'
import CallOverlay from './CallOverlay.jsx'
import useCallCooldown from './useCallCooldown.js'
import { MOCK_DX, MOCK_LAB, MOCK_RX } from './mock.js'
import appIcon from '../assets/icon.svg'
import './index.css'

// Mock counts for the mock-up; set to {} to show real DX/RX from the DB.
const MOCK = { dx: MOCK_DX.length, rx: MOCK_RX.length, lab: MOCK_LAB.length }

// This workstation's service point. ponytail: hard-coded until the settings (gear) screen exists.
const STATION = 'จุดซักประวัติ - 3'

function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [patient, setPatient] = useState(null)
  const cooling = useCallCooldown()
  useEffect(() => window.bar.onPatient(setPatient), [])
  const toggle = (c) => {
    setCollapsed(c)
    window.bar[c ? 'collapse' : 'expand']()
  }

  if (collapsed) return <button className="line" title="Expand" aria-label="Expand" onClick={() => toggle(false)} />

  return (
    <div className="bar">
      <img className="logo" src={appIcon} alt="iQueue" title="iQueue" />
      <span className="hn">HN : {patient?.hn ?? '-'}</span>
      {patient?.fullname && (
        <span className="patient">
          {[patient.fullname, patient.sex, patient.age != null && `${patient.age} ปี`, patient.pttype]
            .filter(Boolean)
            .join('  ·  ')}
        </span>
      )}
      {patient?.hn && (
        <>
          <span className="divider" />
          <button className="vip">VIP</button>
          <span className="divider" />
          <button className="link-btn" onClick={() => window.bar.openPopup('dx')}>
            Dx <span className="count">{MOCK.dx ?? patient.dx ?? 0}</span>
          </button>
          <span className="divider" />
          <button className="link-btn" onClick={() => window.bar.openPopup('rx')}>
            Rx <span className="count">{MOCK.rx ?? patient.rx ?? 0}</span>
          </button>
          <span className="divider" />
          <button className="link-btn" onClick={() => window.bar.openPopup('lab')}>
            Lab <span className="count">{MOCK.lab ?? patient.lab ?? 0}</span>
          </button>
        </>
      )}
      <div className="actions">
        <span className="station" title="จุดบริการของเครื่องนี้">
          {STATION}
        </span>
        {patient?.hn && (
          <>
            <button className="text-btn" disabled={cooling} onClick={() => window.bar.callQueue()}>
              <Volume2 size={14} /> เรียกคิวคนนี้
            </button>
            <span className="divider" />
          </>
        )}
        <button className="text-btn" onClick={() => window.bar.openQueue()}>
          <Users size={14} /> รายการคิว
        </button>
        <button className="icon-btn" title="Settings" aria-label="Settings">
          <Settings size={14} />
        </button>
        <button className="icon-btn" title="Collapse" aria-label="Collapse" onClick={() => toggle(true)}>
          ▴
        </button>
      </div>
    </div>
  )
}

// Other windows (queue modal, Dx/Rx popups) load this same page with a #hash.
const route = location.hash.slice(1)
const page = route === 'queue' ? <Queue /> : route === 'call' ? <CallOverlay /> : ['dx', 'rx', 'lab'].includes(route) ? <Popup kind={route} /> : <App />
createRoot(document.getElementById('root')).render(page)
