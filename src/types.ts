export enum UserRole {
  ADMIN = 'admin',
  EVALUATOR = 'evaluator',
}

export interface User {
  id: string; // Used as email
  name: string;
  role: UserRole;
  password?: string;
}

export interface AnswerKeySection {
  id: string;
  questionNumber: string;
  points: string[];
  maxMarks: number;
}

export interface Exam {
  id: string;
  title: string;
  question_paper_text?: string;
  answer_key_json: string; // Serialized AnswerKeySection[]
  question_paper_pdf?: string; // Base64 or Path
  answer_key_pdf?: string; // Base64 or Path
  created_at: string;
}

export interface Paper {
  id: string;
  exam_id: string;
  student_name: string;
  pdf_base64: string;
  assigned_to: string | null;
  status: 'pending' | 'evaluating' | 'completed';
  marks_json: string | null; // Serialized Record<questionNumber, number>
  digitized_text_json: string | null; // Serialized SegmentedAnswer[]
  remarks?: string;
  exam_title?: string;
  answer_key_json?: string;
  answer_key_pdf?: string;
}

export interface SegmentedAnswer {
  questionId: string;
  questionNumber: string;
  text: string;
  matches: {
    point: string;
    found: boolean;
    startIndex?: number;
    endIndex?: number;
  }[];
}
