import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("evalit.db");
db.pragma('foreign_keys = ON');

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    question_paper_text TEXT,
    answer_key_json TEXT,
    question_paper_pdf TEXT,
    answer_key_pdf TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, -- Use email as ID
    name TEXT NOT NULL,
    role TEXT NOT NULL, -- 'admin' or 'evaluator'
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS papers (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    pdf_base64 TEXT NOT NULL,
    assigned_to TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'evaluating', 'completed'
    marks_json TEXT,
    digitized_text_json TEXT,
    remarks TEXT,
    FOREIGN KEY (exam_id) REFERENCES exams(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
  );

  -- Insert default super admin
  INSERT OR IGNORE INTO users (id, name, role, password) 
  VALUES ('admin_evalit@gmail.com', 'Super Admin', 'admin', '123456');
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  
  // Login
  app.post("/api/login", (req, res) => {
    const { id, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE id = ? AND password = ?").get(id, password) as any;
    if (user) {
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Get all evaluators
  app.get("/api/evaluators", (req, res) => {
    const evaluators = db.prepare("SELECT id, name, role FROM users WHERE role = 'evaluator'").all();
    res.json(evaluators);
  });

  // Create an evaluator
  app.post("/api/evaluators", (req, res) => {
    const { id, name, password } = req.body;
    try {
      db.prepare("INSERT INTO users (id, name, role, password) VALUES (?, ?, 'evaluator', ?)")
        .run(id, name, password);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "ID already exists" });
    }
  });

  // Get all exams
  app.get("/api/exams", (req, res) => {
    const exams = db.prepare("SELECT * FROM exams ORDER BY created_at DESC").all();
    res.json(exams);
  });

  // Create an exam (Subject)
  app.post("/api/exams", (req, res) => {
    const { title, question_paper_text, answer_key_json, question_paper_pdf, answer_key_pdf } = req.body;
    const id = "exam_" + Date.now();
    try {
      db.prepare("INSERT INTO exams (id, title, question_paper_text, answer_key_json, question_paper_pdf, answer_key_pdf) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, title, question_paper_text, answer_key_json, question_paper_pdf, answer_key_pdf);
      res.json({ success: true, id });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to create subject" });
    }
  });

  // Upload answer sheets (bulk)
  app.post("/api/papers/bulk", (req, res) => {
    const { exam_id, papers } = req.body;
    const insert = db.prepare("INSERT INTO papers (id, exam_id, student_name, pdf_base64) VALUES (?, ?, ?, ?)");
    const transaction = db.transaction((papersList) => {
      for (const p of papersList) {
        insert.run(p.id, exam_id, p.student_name, p.pdf_base64);
      }
    });
    transaction(papers);
    res.json({ success: true });
  });

  // Manual Paper Assignment
  app.post("/api/papers/assign", (req, res) => {
    const { paper_ids, evaluator_id } = req.body;
    const stmt = db.prepare("UPDATE papers SET assigned_to = ? WHERE id = ?");
    const transaction = db.transaction((ids) => {
      for (const id of ids) {
        stmt.run(evaluator_id, id);
      }
    });
    transaction(paper_ids);
    res.json({ success: true });
  });

  // Distribute papers
  app.post("/api/papers/distribute", (req, res) => {
    const { exam_id, evaluator_id } = req.body;
    const unassigned = db.prepare("SELECT id FROM papers WHERE exam_id = ? AND assigned_to IS NULL").all(exam_id) as { id: string }[];
    
    if (unassigned.length === 0) return res.json({ success: true, message: "No unassigned papers" });

    if (evaluator_id) {
      const assign = db.prepare("UPDATE papers SET assigned_to = ? WHERE id = ?");
      for (const p of unassigned) {
        assign.run(evaluator_id, p.id);
      }
    } else {
      const evaluators = db.prepare("SELECT id FROM users WHERE role = 'evaluator'").all() as { id: string }[];
      if (evaluators.length === 0) return res.status(400).json({ error: "No evaluators available" });

      const assign = db.prepare("UPDATE papers SET assigned_to = ? WHERE id = ?");
      let evalIdx = 0;
      for (const p of unassigned) {
        assign.run(evaluators[evalIdx].id, p.id);
        evalIdx = (evalIdx + 1) % evaluators.length;
      }
    }
    res.json({ success: true });
  });

  // Get papers for an exam (Inventory)
  app.get("/api/exams/:id/papers", (req, res) => {
    const papers = db.prepare("SELECT id, student_name, assigned_to, status FROM papers WHERE exam_id = ?").all(req.params.id);
    res.json(papers);
  });

  // Get papers assigned to an evaluator
  app.get("/api/evaluator/:userId/papers", (req, res) => {
    const { userId } = req.params;
    const papers = db.prepare(`
      SELECT p.*, e.title as exam_title, e.answer_key_json, e.answer_key_pdf
      FROM papers p 
      JOIN exams e ON p.exam_id = e.id 
      WHERE p.assigned_to = ?
    `).all(userId);
    res.json(papers);
  });

  // Update paper evaluation
  app.post("/api/papers/:paperId/evaluate", (req, res) => {
    const { paperId } = req.params;
    const { marks_json, digitized_text_json, status, remarks } = req.body;
    db.prepare("UPDATE papers SET marks_json = ?, digitized_text_json = ?, status = ?, remarks = ? WHERE id = ?")
      .run(marks_json, digitized_text_json, status, remarks, paperId);
    res.json({ success: true });
  });

  // Delete evaluator
  app.delete("/api/evaluators/:id", (req, res) => {
    console.log(`DELETING Evaluator: ${req.params.id}`);
    const result = db.prepare("DELETE FROM users WHERE id = ? AND role = 'evaluator'").run(req.params.id);
    console.log(`Rows affected: ${result.changes}`);
    res.json({ success: result.changes > 0 });
  });

  // Delete exam and its papers (Hardened)
  app.delete("/api/exams/:id", (req, res) => {
    const { id } = req.params;
    console.log(`[ACTION] FORCE DELETE Subject & Papers for ID: ${id}`);
    try {
      // 1. Force delete all papers first
      const paperResult = db.prepare("DELETE FROM papers WHERE exam_id = ?").run(id);
      
      // 2. Delete the exam itself
      const examResult = db.prepare("DELETE FROM exams WHERE id = ?").run(id);
      
      console.log(`[RESULT] Deleted ${paperResult.changes} papers and ${examResult.changes} exam records.`);
      
      if (examResult.changes > 0) {
        res.json({ success: true, message: "Subject repository deleted successfully." });
      } else {
        // Even if the exam record is missing, return success if papers were cleared
        res.json({ success: paperResult.changes > 0, message: "Cleared associated papers." });
      }
    } catch (e) {
      console.error("[ERROR] Delete Failure:", e);
      res.status(500).json({ error: "System failed to remove repository. Database may be locked." });
    }
  });

  // Delete a specific paper
  app.delete("/api/papers/:id", (req, res) => {
    const { id } = req.params;
    console.log(`[ACTION] DELETE Paper: ${id}`);
    try {
      const result = db.prepare("DELETE FROM papers WHERE id = ?").run(id);
      res.json({ success: result.changes > 0 });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete script." });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
