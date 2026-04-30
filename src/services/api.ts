import { Exam, Paper, User } from "../types";

export const api = {
  login: async (id: string, password: string): Promise<User> => {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, password }),
    });
    if (!res.ok) throw new Error("Invalid credentials");
    return res.json();
  },
  getEvaluators: async (): Promise<User[]> => {
    const res = await fetch("/api/evaluators");
    return res.json();
  },
  createEvaluator: async (evaluator: Partial<User>) => {
    const res = await fetch("/api/evaluators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(evaluator),
    });
    return res.json();
  },
  getExams: async (): Promise<Exam[]> => {
    const res = await fetch("/api/exams");
    return res.json();
  },
  createExam: async (exam: Partial<Exam>) => {
    const res = await fetch("/api/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(exam),
    });
    return res.json();
  },
  uploadPapers: async (examId: string, papers: { id: string; student_name: string; pdf_base64: string }[]) => {
    const res = await fetch("/api/papers/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exam_id: examId, papers }),
    });
    return res.json();
  },
  assignPapers: async (paperIds: string[], evaluatorId: string) => {
    const res = await fetch("/api/papers/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paper_ids: paperIds, evaluator_id: evaluatorId }),
    });
    return res.json();
  },
  distributePapers: async (examId: string, evaluatorId?: string) => {
    const res = await fetch("/api/papers/distribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exam_id: examId, evaluator_id: evaluatorId }),
    });
    return res.json();
  },
  getEvaluatorPapers: async (userId: string): Promise<Paper[]> => {
    const res = await fetch(`/api/evaluator/${userId}/papers`);
    return res.json();
  },
  updatePaperEvaluation: async (paperId: string, data: { marks_json: string; digitized_text_json: string; status: string; remarks?: string }) => {
    const res = await fetch(`/api/papers/${paperId}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  deleteEvaluator: async (id: string) => {
    const res = await fetch(`/api/evaluators/${id}`, { method: "DELETE" });
    return res.json();
  },
  deleteExam: async (id: string) => {
    const res = await fetch(`/api/exams/${id}`, { method: "DELETE" });
    return res.json();
  },
};
