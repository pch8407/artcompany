import express from "express";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Postgres 연결
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 테이블 생성
await pool.query(`
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  value REAL NOT NULL,
  UNIQUE(employee_id, date)
);
`);

// 초기 직원 추가
const initialEmployees = ["창현", "용기", "상화"];
for (const name of initialEmployees) {
  await pool.query(
    `INSERT INTO employees (name) VALUES ($1) ON CONFLICT DO NOTHING`,
    [name]
  );
}

// API

app.get("/api/employees", async (req, res) => {
  const result = await pool.query("SELECT * FROM employees ORDER BY id");
  res.json(result.rows);
});

app.post("/api/employees", async (req, res) => {
  const { name } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO employees (name) VALUES ($1) RETURNING *",
      [name]
    );
    res.json(result.rows[0]);
  } catch {
    res.status(400).json({ error: "이미 존재하는 이름입니다." });
  }
});

app.delete("/api/employees/:id", async (req, res) => {
  await pool.query("DELETE FROM employees WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

app.get("/api/attendance", async (req, res) => {
  const { date, month } = req.query;

  if (date) {
    const result = await pool.query(
      "SELECT * FROM attendance WHERE date = $1",
      [date]
    );
    res.json(result.rows);
  } else if (month) {
    const result = await pool.query(`
      SELECT a.*, e.name as employee_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.date LIKE '${month}%'
    `);
    res.json(result.rows);
  } else {
    res.status(400).json({ error: "date or month required" });
  }
});

app.post("/api/attendance", async (req, res) => {
  const { employee_id, date, value } = req.body;

  await pool.query(`
    INSERT INTO attendance (employee_id, date, value)
    VALUES ($1, $2, $3)
    ON CONFLICT (employee_id, date)
    DO UPDATE SET value = EXCLUDED.value
  `, [employee_id, date, value]);

  res.json({ success: true });
});

app.use(express.static("."));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});