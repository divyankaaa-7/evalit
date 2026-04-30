export enum UserRole {
  ADMIN = 'admin',
  EVALUATOR = 'evaluator',
}

export interface User {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
}

export interface AnswerKeySection {
  id: string;
  questionNumber: string;
  points: string[];
  maxMarks: number;
  mainQuestionNumber?: string;
}

export interface Exam {
  id: string;
  title: string;
  question_paper_text?: string;
  answer_key_json: string; // Serialized AnswerKeySection[]
  max_marks?: number;
  created_at: string;
}

export interface Paper {
  id: string;
  exam_id: string;
  student_name: string;
  pdf_base64: string;
  assigned_to: string | null;
  status: 'pending' | 'evaluating' | 'completed';
  marks_json: string | null; // Serialized Map<questionId, number>
  digitized_text_json: string | null; // Serialized SegmentedAnswer[]
  exam_title?: string;
  answer_key_json?: string;
  max_marks?: number;
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
