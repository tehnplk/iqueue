const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('bar', {
  collapse: () => ipcRenderer.send('collapse'),
  expand: () => ipcRenderer.send('expand'),
  openQueue: () => ipcRenderer.send('open-queue'),
  callQueue: () => ipcRenderer.send('call-queue'),
  getCallCooldown: () => ipcRenderer.invoke('get-call-cooldown'),
  onCallCooldown: (cb) => {
    const listener = (_e, until) => cb(until)
    ipcRenderer.on('call-cooldown', listener)
    return () => ipcRenderer.off('call-cooldown', listener)
  },
  openPopup: (kind) => ipcRenderer.send('open-popup', kind),
  onPatient: (cb) => {
    const listener = (_e, patient) => cb(patient)
    ipcRenderer.on('patient', listener)
    return () => ipcRenderer.off('patient', listener)
  },
})
