import express from "express";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("attendance.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    value REAL NOT NULL,
    UNIQUE(employee_id, date),
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  );
`);

// Insert initial employees if they don't exist
const initialEmployees = ["창현", "용기", "상화"];
const insertEmployee = db.prepare("INSERT OR IGNORE INTO employees (name) VALUES (?)");
initialEmployees.forEach(name => insertEmployee.run(name));

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // Serve static files
  app.use(express.static(path.join(__dirname, ".")));
  app.use("/src", express.static(path.join(__dirname, "src")));

  // API Routes
  app.get("/api/employees", (req, res) => {
    const employees = db.prepare("SELECT * FROM employees").all();
    res.json(employees);
  });

  app.post("/api/employees", (req, res) => {
    const { name } = req.body;
    try {
      const info = db.prepare("INSERT INTO employees (name) VALUES (?)").run(name);
      res.json({ id: info.lastInsertRowid, name });
    } catch (err) {
      res.status(400).json({ error: "이미 존재하는 이름이거나 잘못된 요청입니다." });
    }
  });

  app.delete("/api/employees/:id", (req, res) => {
    const { id } = req.params;
    try {
      // First delete attendance records for this employee
      db.prepare("DELETE FROM attendance WHERE employee_id = ?").run(id);
      // Then delete the employee
      const info = db.prepare("DELETE FROM employees WHERE id = ?").run(id);
      if (info.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "직원을 찾을 수 없습니다." });
      }
    } catch (err) {
      res.status(500).json({ error: "삭제 중 오류가 발생했습니다." });
    }
  });

  app.get("/api/attendance", (req, res) => {
    const { date, month } = req.query;
    if (date) {
      const records = db.prepare("SELECT * FROM attendance WHERE date = ?").all(date);
      res.json(records);
    } else if (month) {
      // month format: YYYY-MM
      const records = db.prepare(`
        SELECT a.*, e.name as employee_name 
        FROM attendance a 
        JOIN employees e ON a.employee_id = e.id 
        WHERE a.date LIKE ?
      `).all(`${month}%`);
      res.json(records);
    } else {
      res.status(400).json({ error: "date or month parameter is required" });
    }
  });

  app.post("/api/attendance", (req, res) => {
    const { employee_id, date, value } = req.body;
    try {
      db.prepare(`
        INSERT INTO attendance (employee_id, date, value) 
        VALUES (?, ?, ?)
        ON CONFLICT(employee_id, date) DO UPDATE SET value = excluded.value
      `).run(employee_id, date, value);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "기록 저장 중 오류가 발생했습니다." });
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
