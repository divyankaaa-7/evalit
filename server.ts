import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("evalit.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    question_paper_text TEXT,
    answer_key_json TEXT,
    max_marks INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT NOT NULL -- 'admin' or 'evaluator'
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
    FOREIGN KEY (exam_id) REFERENCES exams(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
  );
`);

try {
  db.exec("ALTER TABLE users ADD COLUMN email TEXT;");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);");
} catch (e: any) {
  if (!e.message.includes('duplicate column name')) {
    console.error("Migration error (email):", e.message);
  }
}

try {
  db.exec("ALTER TABLE exams ADD COLUMN max_marks INTEGER;");
} catch (e: any) {
  if (!e.message.includes('duplicate column name')) {
    console.error("Migration error (max_marks):", e.message);
  }
}

try {
  db.exec("ALTER TABLE users ADD COLUMN password TEXT;");
} catch (e: any) {
  if (!e.message.includes('duplicate column name')) {
    console.error("Migration error (password):", e.message);
  }
}

db.exec(`
  -- Ensure admin exists and has credentials
  INSERT OR IGNORE INTO users (id, name, email, password, role) 
  VALUES ('admin1', 'Super Admin', 'admin@evalit.com', 'adminpassword', 'admin');
  
  UPDATE users SET email = 'admin@evalit.com', password = 'adminpassword' WHERE id = 'admin1';
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '200mb' }));

  // API Routes

  // Login
  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND password = ?").get(email, password);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json(user);
  });

  // Get all evaluators
  app.get("/api/evaluators", (req, res) => {
    const evaluators = db.prepare("SELECT id, name, email, role FROM users WHERE role = 'evaluator'").all();
    res.json(evaluators);
  });

  // Create evaluators
  app.post("/api/evaluators", (req, res) => {
    const { evaluators } = req.body;
    const insert = db.prepare("INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, 'evaluator')");

    try {
      const transaction = db.transaction((evalList) => {
        for (const e of evalList) {
          insert.run('eval_' + Math.random().toString(36).substr(2, 9), e.name, e.email, e.password);
        }
      });
      transaction(evaluators);
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(400).json({ error: "One or more emails already exist." });
      } else {
        res.status(500).json({ error: "Failed to create evaluators" });
      }
    }
  });

  // Update evaluator
  app.put("/api/evaluators/:id", (req, res) => {
    const { id } = req.params;
    const { name, email, password } = req.body;
    try {
      db.prepare("UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?").run(name, email, password, id);
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(400).json({ error: "Email already exists." });
      } else {
        res.status(500).json({ error: "Failed to update evaluator" });
      }
    }
  });

  // Delete evaluator
  app.delete("/api/evaluators/:id", (req, res) => {
    try {
      const { id } = req.params;
      db.prepare("UPDATE papers SET assigned_to = NULL WHERE assigned_to = ?").run(id);
      db.prepare("DELETE FROM users WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete evaluator" });
    }
  });

  // Get all exams
  app.get("/api/exams", (req, res) => {
    const exams = db.prepare("SELECT * FROM exams ORDER BY created_at DESC").all();
    res.json(exams);
  });

  // Create an exam
  app.post("/api/exams", (req, res) => {
    const { id, title, question_paper_text, answer_key_json, max_marks } = req.body;
    db.prepare("INSERT INTO exams (id, title, question_paper_text, answer_key_json, max_marks) VALUES (?, ?, ?, ?, ?)").run(id, title, question_paper_text, answer_key_json, max_marks);
    res.json({ success: true });
  });

  // Delete an exam
  app.delete("/api/exams/:id", (req, res) => {
    try {
      const { id } = req.params;
      db.prepare("DELETE FROM papers WHERE exam_id = ?").run(id);
      db.prepare("DELETE FROM exams WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete exam" });
    }
  });

  // Upload answer sheets (bulk)
  app.post("/api/papers/bulk", (req, res) => {
    try {
      const { exam_id, papers } = req.body;
      if (!papers || papers.length === 0) return res.status(400).json({ error: "No papers provided" });
      
      const insert = db.prepare("INSERT INTO papers (id, exam_id, student_name, pdf_base64) VALUES (?, ?, ?, ?)");
      const transaction = db.transaction((papersList) => {
        for (const p of papersList) {
          insert.run(p.id, exam_id, p.student_name, p.pdf_base64);
        }
      });
      transaction(papers);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Bulk upload error:", error);
      res.status(500).json({ error: "Failed to upload papers." });
    }
  });

  // Get unassigned papers for an exam
  app.get("/api/exams/:examId/unassigned-papers", (req, res) => {
    try {
      const { examId } = req.params;
      const papers = db.prepare("SELECT * FROM papers WHERE exam_id = ? AND assigned_to IS NULL").all(examId);
      res.json(papers);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch unassigned papers" });
    }
  });

  // Distribute papers equally
  app.post("/api/papers/distribute", (req, res) => {
    try {
      const { exam_id } = req.body;
      const evaluators = db.prepare("SELECT id FROM users WHERE role = 'evaluator'").all() as { id: string }[];
      const papers = db.prepare("SELECT id FROM papers WHERE exam_id = ? AND assigned_to IS NULL").all(exam_id) as { id: string }[];

      if (evaluators.length === 0) return res.status(400).json({ error: "No evaluators available. Please create evaluators first." });
      if (papers.length === 0) return res.status(400).json({ error: "No unassigned papers available for this exam." });

      const N = papers.length;
      const M = evaluators.length;
      const papersPerEvaluator = Math.floor(N / M);
      const remaining = N % M;

      const transaction = db.transaction(() => {
        let paperIndex = 0;
        for (let i = 0; i < M; i++) {
          const evalId = evaluators[i].id;
          const count = papersPerEvaluator + (i < remaining ? 1 : 0);

          for (let j = 0; j < count; j++) {
            if (paperIndex < N) {
              db.prepare("UPDATE papers SET assigned_to = ? WHERE id = ?").run(evalId, papers[paperIndex].id);
              paperIndex++;
            }
          }
        }
      });
      transaction();
      res.json({ success: true });
    } catch (error: any) {
      console.error("Distribute error:", error);
      res.status(500).json({ error: "Failed to distribute papers." });
    }
  });

  // Get papers assigned to an evaluator
  app.get("/api/evaluator/:userId/papers", (req, res) => {
    const { userId } = req.params;
    const papers = db.prepare(`
      SELECT p.*, e.title as exam_title, e.answer_key_json, e.max_marks 
      FROM papers p 
      JOIN exams e ON p.exam_id = e.id 
      WHERE p.assigned_to = ?
    `).all(userId);
    res.json(papers);
  });

  // Update paper evaluation
  app.post("/api/papers/:paperId/evaluate", (req, res) => {
    const { paperId } = req.params;
    const { marks_json, digitized_text_json, status } = req.body;
    db.prepare("UPDATE papers SET marks_json = ?, digitized_text_json = ?, status = ? WHERE id = ?")
      .run(marks_json, digitized_text_json, status, paperId);
    res.json({ success: true });
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
