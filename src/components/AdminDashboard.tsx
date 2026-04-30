import { useState, useEffect } from 'react';
import { User, Exam, AnswerKeySection } from '../types';
import { api } from '../services/api';
import { Plus, FileText, Upload, Users, CheckCircle, ChevronRight, Trash2, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { aiService } from '../services/ai';

export default function AdminDashboard({ user }: { user: User }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [allEvaluators, setAllEvaluators] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamMaxMarks, setNewExamMaxMarks] = useState(100);
  const [answerKey, setAnswerKey] = useState<AnswerKeySection[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [showCreateEval, setShowCreateEval] = useState(false);
  const [showManageEval, setShowManageEval] = useState(false);
  const [evaluatorsToCreate, setEvaluatorsToCreate] = useState([{ name: '', email: '', password: '' }]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const data = await api.getExams();
    setExams(data);
    const evals = await api.getEvaluators();
    setAllEvaluators(evals);
  };

  const handleAnswerKeyUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const extracted = await aiService.extractAnswerKey(base64);
      setAnswerKey(extracted.sections);
      setNewExamMaxMarks(extracted.totalMaxMarks);
      alert('Answer key extracted successfully!');
    } catch (err) {
      alert("Failed to extract answer key. Please check console for errors.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExam = async () => {
    if (!newExamTitle) return;
    setLoading(true);
    try {
      await api.createExam({
        id: 'exam_' + Date.now(),
        title: newExamTitle,
        answer_key_json: JSON.stringify(answerKey),
        max_marks: newExamMaxMarks
      });
      setNewExamTitle('');
      setAnswerKey([]);
      setShowCreate(false);
      loadData();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExam = async (examId: string) => {
    if (!window.confirm("Are you sure you want to delete this exam and all its papers?")) return;
    setLoading(true);
    try {
      await api.deleteExam(examId);
      alert('Exam deleted successfully');
      loadData();
    } catch (e: any) {
      alert(e.message || "Failed to delete exam");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvaluators = async () => {
    setLoading(true);
    try {
      await api.createEvaluators(evaluatorsToCreate);
      alert('Evaluators created successfully');
      setShowCreateEval(false);
      setEvaluatorsToCreate([{ name: '', email: '', password: '' }]);
      loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to create evaluators');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvaluator = async (evalId: string) => {
    if (!window.confirm("Are you sure you want to delete this evaluator?")) return;
    setLoading(true);
    try {
      await api.deleteEvaluator(evalId);
      loadData();
    } catch (e: any) {
      alert(e.message || "Failed to delete evaluator");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEvaluator = async (evalId: string, updatedData: any) => {
    setLoading(true);
    try {
      await api.updateEvaluator(evalId, updatedData);
      alert("Evaluator updated");
      loadData();
    } catch (e: any) {
      alert(e.message || "Failed to update evaluator");
    } finally {
      setLoading(false);
    }
  };

  const handleNumEvaluatorsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = Math.max(1, parseInt(e.target.value) || 1);
    const current = [...evaluatorsToCreate];
    while (current.length < num) current.push({ name: '', email: '', password: '' });
    while (current.length > num) current.pop();
    setEvaluatorsToCreate(current);
  };

  const handleBulkUpload = async (examId: string, files: FileList | null) => {
    if (!files) return;
    setLoading(true);
    try {
      const papers = await Promise.all(
        Array.from(files).map(async (file) => {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          return {
            id: 'paper_' + Math.random().toString(36).substr(2, 9),
            student_name: file.name.replace('.pdf', ''),
            pdf_base64: base64
          };
        })
      );
      await api.uploadPapers(examId, papers);
      alert('Papers uploaded successfully');
      loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to upload papers');
    } finally {
      setLoading(false);
    }
  };

  const handleDistribute = async (examId: string) => {
    setLoading(true);
    try {
      const exam = exams.find(e => e.id === examId);
      if (!exam) return;
      const answerKey = JSON.parse(exam.answer_key_json || '[]');

      const unassignedPapers = await api.getUnassignedPapers(examId);
      
      if (unassignedPapers.length > 0) {
        for (let i = 0; i < unassignedPapers.length; i++) {
          const paper = unassignedPapers[i];
          setLoadingMsg(`Digitizing paper ${i + 1} of ${unassignedPapers.length} via AI... (This takes ~15s per paper)`);
          
          try {
            const result = await aiService.processAnswerSheet(paper.pdf_base64, answerKey);
            await api.updatePaperEvaluation(paper.id, {
              digitized_text_json: JSON.stringify(result),
              marks_json: '{}',
              status: 'pending'
            });
          } catch (aiErr) {
            console.error("AI Error for paper", paper.id, aiErr);
            // We continue processing others even if one fails
          }
        }
      }

      setLoadingMsg("Distributing to evaluators...");
      await api.distributePapers(examId);
      alert('Papers distributed equally among evaluators');
    } catch (e: any) {
      alert(e.message || 'Failed to distribute papers');
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-serif italic">Administrator Overview</h2>
          <p className="text-zinc-500 text-sm">Manage exams, answer keys, and distribution</p>
          {loadingMsg && <p className="text-orange-600 font-bold text-sm mt-2 animate-pulse">{loadingMsg}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowManageEval(!showManageEval); setShowCreateEval(false); setShowCreate(false); }}
            className="flex items-center gap-2 px-4 py-2 border border-zinc-900 text-zinc-900 text-sm font-medium hover:bg-zinc-50 transition-colors"
          >
            {showManageEval ? 'Close' : <><Users className="w-4 h-4" /> Manage Evaluators</>}
          </button>
          <button
            onClick={() => { setShowCreateEval(!showCreateEval); setShowManageEval(false); setShowCreate(false); }}
            className="flex items-center gap-2 px-4 py-2 border border-zinc-900 text-zinc-900 text-sm font-medium hover:bg-zinc-50 transition-colors"
          >
            {showCreateEval ? 'Discard' : <><UserPlus className="w-4 h-4" /> Create Evaluators</>}
          </button>
          <button
            onClick={() => { setShowCreate(!showCreate); setShowCreateEval(false); setShowManageEval(false); }}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            {showCreate ? 'Discard' : <><Plus className="w-4 h-4" /> Create New Exam</>}
          </button>
        </div>
      </div>

      {showManageEval && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-zinc-200 p-8 shadow-sm"
        >
          <h3 className="text-lg font-medium mb-6">Manage Existing Evaluators</h3>
          <div className="space-y-4">
            {allEvaluators.length === 0 ? (
              <p className="text-sm text-zinc-500">No evaluators exist.</p>
            ) : (
              allEvaluators.map((evaluator) => (
                <div key={evaluator.id} className="flex gap-4 items-center p-4 bg-zinc-50 border border-zinc-100">
                  <input
                    type="text"
                    defaultValue={evaluator.name}
                    onBlur={(e) => handleUpdateEvaluator(evaluator.id, { ...evaluator, name: e.target.value })}
                    className="flex-1 p-2 text-sm border border-zinc-200"
                  />
                  <input
                    type="email"
                    defaultValue={evaluator.email}
                    onBlur={(e) => handleUpdateEvaluator(evaluator.id, { ...evaluator, email: e.target.value })}
                    className="flex-1 p-2 text-sm border border-zinc-200"
                  />
                  <input
                    type="password"
                    placeholder="New Password (optional)"
                    onBlur={(e) => e.target.value && handleUpdateEvaluator(evaluator.id, { ...evaluator, password: e.target.value })}
                    className="flex-1 p-2 text-sm border border-zinc-200"
                  />
                  <button 
                    onClick={() => handleDeleteEvaluator(evaluator.id)}
                    className="p-2 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {showCreateEval && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-zinc-200 p-8 shadow-sm"
        >
          <div className="max-w-3xl space-y-6">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-2">Number of Evaluators</label>
              <input
                type="number"
                min="1"
                value={evaluatorsToCreate.length}
                onChange={handleNumEvaluatorsChange}
                className="w-32 p-3 border border-zinc-200 focus:border-zinc-900 outline-none transition-colors"
              />
            </div>

            <div className="space-y-4">
              {evaluatorsToCreate.map((evaluator, idx) => (
                <div key={idx} className="p-4 bg-zinc-50 border border-zinc-100 flex gap-4 items-center">
                  <div className="w-8 text-xs font-mono text-zinc-400">#{idx + 1}</div>
                  <input
                    type="text"
                    placeholder="Name"
                    value={evaluator.name}
                    onChange={(e) => {
                      const updated = [...evaluatorsToCreate];
                      updated[idx].name = e.target.value;
                      setEvaluatorsToCreate(updated);
                    }}
                    className="flex-1 p-2 text-sm border border-zinc-200 focus:border-zinc-900 outline-none"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={evaluator.email}
                    onChange={(e) => {
                      const updated = [...evaluatorsToCreate];
                      updated[idx].email = e.target.value;
                      setEvaluatorsToCreate(updated);
                    }}
                    className="flex-1 p-2 text-sm border border-zinc-200 focus:border-zinc-900 outline-none"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={evaluator.password}
                    onChange={(e) => {
                      const updated = [...evaluatorsToCreate];
                      updated[idx].password = e.target.value;
                      setEvaluatorsToCreate(updated);
                    }}
                    className="flex-1 p-2 text-sm border border-zinc-200 focus:border-zinc-900 outline-none"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleCreateEvaluators}
              disabled={loading || evaluatorsToCreate.some(e => !e.name || !e.email || !e.password)}
              className="w-full py-3 bg-zinc-900 text-white font-medium disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Save Evaluators to Database'}
            </button>
          </div>
        </motion.div>
      )}

      {showCreate && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-zinc-200 p-8 shadow-sm"
        >
          <div className="max-w-3xl space-y-6">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-2">Exam Title</label>
              <input
                type="text"
                value={newExamTitle}
                onChange={(e) => setNewExamTitle(e.target.value)}
                placeholder="e.g. Mathematics Mid-Term 2024"
                className="w-full p-3 border border-zinc-200 focus:border-zinc-900 outline-none transition-colors"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Answer Key Source</label>
              </div>

              <div className="p-8 border-2 border-dashed border-zinc-200 bg-zinc-50 flex flex-col items-center justify-center gap-4">
                <FileText className="w-8 h-8 text-zinc-300" />
                <div className="text-center">
                  <p className="text-sm font-medium text-zinc-700">Upload PDF or DOCX</p>
                  <p className="text-xs text-zinc-500 mt-1">AI will automatically extract questions and marks</p>
                </div>
                <label className="px-4 py-2 bg-white border border-zinc-200 text-xs font-medium cursor-pointer hover:bg-zinc-50 transition-colors">
                  Select File
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    className="hidden"
                    onChange={handleAnswerKeyUpload}
                  />
                </label>
              </div>

              {answerKey.length > 0 && (
                <div className="space-y-4 mt-4">
                  <div className="p-4 bg-green-50 border border-green-100 text-sm text-green-800">
                    <span className="font-bold">Success!</span> Extracted {answerKey.length} questions from the document.
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-2">Maximum Exam Marks</label>
                    <input
                      type="number"
                      value={newExamMaxMarks}
                      onChange={(e) => setNewExamMaxMarks(parseInt(e.target.value) || 0)}
                      className="w-32 p-3 border border-zinc-200 focus:border-zinc-900 outline-none transition-colors"
                    />
                    <p className="text-xs text-zinc-500 mt-1">Automatically extracted. Edit if incorrect.</p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleCreateExam}
              disabled={loading || !newExamTitle}
              className="w-full py-3 bg-zinc-900 text-white font-medium disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Initialize Exam & Store Answer Key'}
            </button>
          </div>
        </motion.div>
      )}

      {!showCreate && !showCreateEval && !showManageEval && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {exams.map((exam) => (
          <div key={exam.id} className="bg-white border border-zinc-200 p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <FileText className="w-8 h-8 text-zinc-200" />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-zinc-400">{new Date(exam.created_at).toLocaleDateString()}</span>
                  <button onClick={() => handleDeleteExam(exam.id)} className="text-red-500 hover:text-red-700 ml-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="text-xl font-medium mb-1">{exam.title}</h3>
              <div className="flex flex-col gap-1 mb-6">
                <span className="text-xs text-zinc-500 uppercase tracking-widest">
                  {JSON.parse(exam.answer_key_json).length} Questions
                </span>
                <span className="text-xs text-zinc-500 uppercase tracking-widest">
                  {exam.paper_count || 0} Papers Uploaded
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-6 border-t border-zinc-50">
              <label className="flex items-center justify-center gap-2 px-3 py-2 border border-zinc-200 text-xs font-medium cursor-pointer hover:bg-zinc-50">
                <Upload className="w-3 h-3" />
                Upload Papers
                <input
                  type="file"
                  multiple
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => handleBulkUpload(exam.id, e.target.files)}
                />
              </label>
              <button
                onClick={() => handleDistribute(exam.id)}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-zinc-50 text-xs font-medium hover:bg-zinc-100"
              >
                <Users className="w-3 h-3" />
                Distribute
              </button>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
