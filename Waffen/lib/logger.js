const pad = (n) => n.toString().padStart(2, '0')
const time = () => {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const info = (...args) => console.log(`[${time()}] INFO`, ...args)
const warn = (...args) => console.warn(`[${time()}] WARN`, ...args)
const error = (...args) => console.error(`[${time()}] ERROR`, ...args)
const debug = (...args) => console.log(`[${time()}] DEBUG`, ...args)

export default { info, warn, error, debug }
