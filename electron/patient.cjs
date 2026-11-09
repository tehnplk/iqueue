const path = require('node:path')
const mysql = require('mysql2/promise')

// Connection settings live in .env (not in source): HOS_DB_HOST, HOS_DB_PORT, HOS_DB_USER, HOS_DB_PASSWORD, HOS_DB_NAME
try {
  process.loadEnvFile(path.join(__dirname, '../.env'))
} catch {
  console.warn('patient: no .env found; using process env only')
}

const pool = mysql.createPool({
  host: process.env.HOS_DB_HOST || '127.0.0.1',
  port: Number(process.env.HOS_DB_PORT || 3306),
  user: process.env.HOS_DB_USER,
  password: process.env.HOS_DB_PASSWORD,
  database: process.env.HOS_DB_NAME,
  charset: 'utf8mb4', // tables are tis620; server converts
  connectionLimit: 2,
})

const SEX = { 1: 'ชาย', 2: 'หญิง' }

// Visit-level data (rights, DX, RX) comes from the latest visit — the one HOSxP shows.
// Rights fall back to the patient's registered pttype when there is no visit.
async function fetchPatient(hn) {
  const [rows] = await pool.query(
    `SELECT CONCAT(IFNULL(p.pname,''), p.fname, ' ', p.lname) AS fullname,
            p.sex,
            TIMESTAMPDIFF(YEAR, p.birthday, CURDATE()) AS age,
            t.name AS pttype,
            (SELECT COUNT(*) FROM ovstdiag g WHERE g.vn = v.vn) AS dx,
            (SELECT COUNT(*) FROM opitemrece o JOIN drugitems d ON d.icode = o.icode WHERE o.vn = v.vn) AS rx
       FROM patient p
       LEFT JOIN ovst v ON v.vn = (SELECT x.vn FROM ovst x WHERE x.hn = p.hn ORDER BY x.vstdate DESC, x.vsttime DESC LIMIT 1)
       LEFT JOIN pttype t ON t.pttype = COALESCE(v.pttype, NULLIF(p.pttype, ''))
      WHERE p.hn = ?`,
    [hn],
  )
  const r = rows[0]
  return r && { fullname: r.fullname, sex: SEX[r.sex] ?? null, age: r.age, pttype: r.pttype, dx: Number(r.dx), rx: Number(r.rx) }
}

module.exports = { fetchPatient }
