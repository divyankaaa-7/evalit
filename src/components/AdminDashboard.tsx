import { useState, useEffect } from 'react';
import { User, Exam, AnswerKeySection } from '../types';
import { api } from '../services/api';
import { aiService } from '../services/ai';
import { Plus, FileText, Upload, Users, Shield, UserPlus, Key, ArrowRight, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminDashboard({ user }: { user: User }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [evaluators, setEvaluators] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showEvalManager, setShowEvalManager] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, type: 'exam' | 'evaluator', title: string } | null>(null);
  
  // Create Exam State
  const [newExamTitle, setNewExamTitle] = useState('');
  const [answerKey, setAnswerKey] = useState<AnswerKeySection[]>([]);
  const [qpPdf, setQpPdf] = useState<string | null>(null);
  const [akPdf, setAkPdf] = useState<string | null>(null);
  
  // Create Evaluator State
  const [newEvalName, setNewEvalName] = useState('');
  const [newEvalId, setNewEvalId] = useState('');
  const [newEvalPassword, setNewEvalPassword] = useState('');
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [examsData, evalsData] = await Promise.all([
      api.getExams(),
      api.getEvaluators()
    ]);
    setExams(examsData);
    setEvaluators(evalsData);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'qp' | 'ak') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (type === 'qp') setQpPdf(reader.result as string);
      else setAkPdf(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const addQuestionToKey = () => {
    const num = answerKey.length + 1;
    setAnswerKey([...answerKey, { 
      id: Math.random().toString(36).substr(2, 9),
      questionNumber: `Q${num}`,
      points: [''],
      maxMarks: 5
    }]);
  };

  const handleCreateExam = async () => {
    if (!newExamTitle || !akPdf || !qpPdf) {
      alert('Please provide title, Question Paper, and Answer Key PDF.');
      return;
    }
    setLoading(true);
    try {
      await api.createExam({
        id: 'subject_' + Date.now(),
        title: newExamTitle,
        answer_key_json: JSON.stringify(answerKey),
        question_paper_pdf: qpPdf,
        answer_key_pdf: akPdf
      });
      setNewExamTitle('');
      setAnswerKey([]);
      setQpPdf(null);
      setAkPdf(null);
      setShowCreate(false);
      loadData();
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvaluator = async () => {
    if (!newEvalName || !newEvalId || !newEvalPassword) return;
    setLoading(true);
    try {
      await api.createEvaluator({
        id: newEvalId,
        name: newEvalName,
        password: newEvalPassword
      });
      setNewEvalName('');
      setNewEvalId('');
      setNewEvalPassword('');
      loadData();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvaluator = async (id: string) => {
    const res = await api.deleteEvaluator(id);
    if (res.success) {
      loadData();
    } else {
      alert('Failed to revoke access.');
    }
    setConfirmDelete(null);
  };

  const handleDeleteExam = async (id: string) => {
    const res = await api.deleteExam(id);
    if (res.success) {
      loadData();
    } else {
      alert('Failed to delete subject.');
    }
    setConfirmDelete(null);
  };

  const handleDeletePaper = async (id: string) => {
    const res = await fetch(`/api/papers/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadData();
    } else {
      alert('Failed to delete script.');
    }
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-8">
      {/* Header with Dual Actions */}
      <div className="flex justify-between items-center bg-white p-6 border border-zinc-200 shadow-sm">
        <div>
          <h2 className="text-3xl font-serif italic">Administrator Command</h2>
          <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold mt-1">Manage Subjects & Personnel</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => { setShowEvalManager(!showEvalManager); setShowCreate(false); }}
            className="flex items-center gap-2 px-4 py-2 border border-zinc-900 text-zinc-900 text-xs font-bold uppercase tracking-widest hover:bg-zinc-50 transition-colors"
          >
            <Users className="w-4 h-4" /> Evaluators
          </button>
          <button 
            onClick={() => { setShowCreate(!showCreate); setShowEvalManager(false); }}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors"
          >
            {showCreate ? 'Discard' : <><Plus className="w-4 h-4" /> Initialize Subject</>}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {/* Deletion Confirmation Modal */}
        {confirmDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white max-w-md w-full p-8 shadow-2xl border border-zinc-200"
            >
              <div className="flex items-center gap-4 text-red-600 mb-6">
                <Shield className="w-8 h-8" />
                <h3 className="text-xl font-serif italic">Confirm Deletion</h3>
              </div>
              <p className="text-zinc-600 text-sm mb-8 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-zinc-900">"{confirmDelete.title}"</span>? 
                This action is permanent and will remove all associated records and files from the system.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3 bg-zinc-100 text-zinc-900 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (confirmDelete.type === 'exam') handleDeleteExam(confirmDelete.id);
                    else if (confirmDelete.type === 'evaluator') handleDeleteEvaluator(confirmDelete.id);
                    else handleDeletePaper(confirmDelete.id);
                  }}
                  className="flex-1 py-3 bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Evaluator Management Panel */}
        {showEvalManager && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white border border-zinc-200 p-8 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                  <UserPlus className="w-4 h-4" /> Register New Evaluator
                </h4>
                <div className="space-y-4">
                  <input 
                    type="text" placeholder="Full Name" value={newEvalName}
                    onChange={(e) => setNewEvalName(e.target.value)}
                    className="w-full p-3 border border-zinc-100 bg-zinc-50 focus:bg-white focus:border-zinc-900 outline-none transition-all text-sm"
                  />
                  <input 
                    type="email" placeholder="ID / Email" value={newEvalId}
                    onChange={(e) => setNewEvalId(e.target.value)}
                    className="w-full p-3 border border-zinc-100 bg-zinc-50 focus:bg-white focus:border-zinc-900 outline-none transition-all text-sm"
                  />
                  <input 
                    type="password" placeholder="Access Password" value={newEvalPassword}
                    onChange={(e) => setNewEvalPassword(e.target.value)}
                    className="w-full p-3 border border-zinc-100 bg-zinc-50 focus:bg-white focus:border-zinc-900 outline-none transition-all text-sm"
                  />
                  <button 
                    onClick={handleCreateEvaluator}
                    className="w-full py-3 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors"
                  >
                    Grant Access
                  </button>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold uppercase tracking-widest mb-6">Active Evaluators</h4>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                  {evaluators.map(ev => (
                    <div key={ev.id} className="flex items-center justify-between p-3 border border-zinc-50 bg-zinc-50">
                      <div>
                        <div className="text-sm font-medium">{ev.name}</div>
                        <div className="text-[10px] text-zinc-400 font-mono">{ev.id}</div>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: ev.id, type: 'evaluator', title: ev.name }); }}
                        className="p-2 text-zinc-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Subject Creation Panel */}
        {showCreate && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white border border-zinc-200 p-8 shadow-sm">
              <div className="max-w-4xl mx-auto space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-2">Subject Title</label>
                      <input 
                        type="text" value={newExamTitle} onChange={(e) => setNewExamTitle(e.target.value)}
                        placeholder="e.g. Advanced Microbiology 2024"
                        className="w-full p-4 border border-zinc-100 bg-zinc-50 focus:bg-white focus:border-zinc-900 outline-none transition-all text-lg font-serif"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Question Paper</label>
                        <label className={`flex flex-col items-center justify-center h-32 border-2 border-dashed transition-colors cursor-pointer ${qpPdf ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-zinc-50 border-zinc-100 hover:border-zinc-900'}`}>
                          <Upload className="w-6 h-6 mb-2" />
                          <span className="text-[10px] uppercase font-bold">{qpPdf ? 'Uploaded' : 'Upload PDF'}</span>
                          <input type="file" accept=".pdf" className="hidden" onChange={(e) => handleFileUpload(e, 'qp')} />
                        </label>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Answer Key PDF</label>
                        <label className={`flex flex-col items-center justify-center h-32 border-2 border-dashed transition-colors cursor-pointer ${akPdf ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-zinc-50 border-zinc-100 hover:border-zinc-900'}`}>
                          <Upload className="w-6 h-6 mb-2" />
                          <span className="text-[10px] uppercase font-bold">{akPdf ? 'Uploaded' : 'Upload PDF'}</span>
                          <input type="file" accept=".pdf" className="hidden" onChange={(e) => handleFileUpload(e, 'ak')} />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Structured Answer Key</label>
                      <button onClick={addQuestionToKey} className="text-xs font-bold text-zinc-900 hover:underline">+ Add Question</button>
                    </div>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                      {answerKey.map((q, idx) => (
                        <div key={q.id} className="p-4 bg-zinc-50 border border-zinc-100 space-y-3">
                          <div className="flex gap-4">
                            <input 
                              type="text" value={q.questionNumber}
                              onChange={(e) => {
                                const k = [...answerKey]; k[idx].questionNumber = e.target.value; setAnswerKey(k);
                              }}
                              className="w-20 p-2 text-sm font-bold bg-white border border-zinc-100"
                            />
                            <input 
                              type="number" value={q.maxMarks}
                              onChange={(e) => {
                                const k = [...answerKey]; k[idx].maxMarks = parseInt(e.target.value); setAnswerKey(k);
                              }}
                              className="w-24 p-2 text-sm bg-white border border-zinc-100"
                            />
                          </div>
                          {q.points.map((p, pIdx) => (
                            <input 
                              key={pIdx} type="text" value={p}
                              onChange={(e) => {
                                const k = [...answerKey]; k[idx].points[pIdx] = e.target.value; setAnswerKey(k);
                              }}
                              placeholder="Key Point"
                              className="w-full p-2 text-xs bg-white border border-zinc-100"
                            />
                          ))}
                          <button 
                            onClick={() => { const k = [...answerKey]; k[idx].points.push(''); setAnswerKey(k); }}
                            className="text-[10px] uppercase font-bold text-zinc-400 hover:text-zinc-900"
                          >
                            + Add Point
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleCreateExam}
                  disabled={loading || !newExamTitle || !akPdf || !qpPdf}
                  className="w-full py-5 bg-zinc-900 text-white font-bold uppercase tracking-[0.2em] text-sm disabled:opacity-50 transition-all hover:bg-black"
                >
                  {loading ? 'Processing...' : 'Initialize Subject Repository'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subject List */}
      <div className="grid grid-cols-1 gap-6">
        {exams.map((exam) => (
          <SubjectCard 
            key={exam.id} 
            exam={exam} 
            evaluators={evaluators}
            onUpdate={loadData}
            onDelete={() => setConfirmDelete({ id: exam.id, type: 'exam', title: exam.title })}
          />
        ))}
      </div>
    </div>
  );
}

function SubjectCard({ exam, evaluators, onUpdate, onDelete }: { exam: Exam, evaluators: User[], onUpdate: () => void, onDelete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [selectedEvaluator, setSelectedEvaluator] = useState('');
  const [papers, setPapers] = useState<Paper[]>([]);
  const [showPapers, setShowPapers] = useState(false);

  useEffect(() => {
    if (showPapers) loadPapers();
  }, [showPapers]);

  const loadPapers = async () => {
    const res = await fetch(`/api/exams/${exam.id}/papers`);
    const data = await res.json();
    setPapers(data);
  };
  
  const handleBulkUpload = async (files: FileList | null) => {
    if (!files) return;
    setLoading(true);
    try {
      const paperList = await Promise.all(
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
      
      await api.uploadPapers(exam.id, paperList);
      
      // Always digitize all uploaded papers immediately
      alert(`Processing & Digitizing ${paperList.length} scripts. Please wait...`);
      const answerKey = JSON.parse(exam.answer_key_json);
      for (const p of paperList) {
        try {
          const digitized = await aiService.processAnswerSheet(p.pdf_base64, answerKey);
          await api.updatePaperEvaluation(p.id, {
            digitized_text_json: JSON.stringify(digitized),
            marks_json: '{}',
            status: 'pending'
          });
        } catch (e) { console.error(`Digitization failed for ${p.id}:`, e); }
      }

      // If an evaluator is selected, assign them
      if (selectedEvaluator) {
        const paperIds = paperList.map(p => p.id);
        await api.assignPapers(paperIds, selectedEvaluator);
      }

      alert(`${paperList.length} scripts processed and uploaded ${selectedEvaluator ? '& assigned' : ''} successfully.`);
      loadPapers();
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  const processPapers = async (paperIds: string[]) => {
    const papersToProcess = papers.filter(p => paperIds.includes(p.id) && (!p.digitized_text_json || p.digitized_text_json === '[]'));
    if (papersToProcess.length === 0) return;

    setLoading(true);
    for (const paper of papersToProcess) {
      try {
        const answerKey = JSON.parse(exam.answer_key_json);
        const digitized = await aiService.processAnswerSheet(paper.pdf_base64, answerKey);
        await api.updatePaperEvaluation(paper.id, {
          digitized_text_json: JSON.stringify(digitized),
          marks_json: '{}',
          status: 'pending'
        });
      } catch (e) {
        console.error(`Failed to digitize paper ${paper.id}:`, e);
      }
    }
    setLoading(false);
  };

  const handleDistribute = async () => {
    setLoading(true);
    try {
      const unassignedIds = papers.filter(p => !p.assigned_to).map(p => p.id);
      if (unassignedIds.length > 0) {
        alert(`Starting OCR & Digitization for ${unassignedIds.length} scripts. Please wait...`);
        await processPapers(unassignedIds);
      }
      
      await api.distributePapers(exam.id, selectedEvaluator || undefined);
      alert(selectedEvaluator ? 'Scripts digitized and assigned to selected evaluator.' : 'Scripts digitized and distributed equally.');
      loadPapers();
      onUpdate();
    } catch (e) {
      alert('Failed to process and distribute papers.');
    } finally {
      setLoading(false);
    }
  };

  const openPdf = (base64: string | undefined) => {
    if (!base64) return;
    try {
      // Use a blob for better compatibility with large PDFs
      const base64Data = base64.split(',')[1] || base64;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      console.error('Failed to open PDF:', e);
      // Fallback to direct window.open if blob fails
      const win = window.open();
      if (win) win.document.write(`<iframe src="${base64}" frameborder="0" style="border:0; width:100%; height:100%;" allowfullscreen></iframe>`);
    }
  };

  return (
    <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden flex flex-col relative group">
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-4 right-4 p-2 text-zinc-300 hover:text-red-500 transition-all z-10"
      >
        <Trash2 className="w-5 h-5" />
      </button>

      <div className="flex flex-col md:flex-row">
        <div className="p-8 md:w-1/2 space-y-6 border-b md:border-b-0 md:border-r border-zinc-100">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-zinc-900 text-white">
              <FileText className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-mono text-zinc-400">{new Date(exam.created_at).toLocaleDateString()}</span>
          </div>
          <div>
            <h3 className="text-2xl font-serif italic mb-2">{exam.title}</h3>
            <div className="flex gap-4">
              <div className="px-2 py-1 bg-zinc-50 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                {JSON.parse(exam.answer_key_json).length} Questions
              </div>
              <button 
                onClick={() => setShowPapers(!showPapers)}
                className="px-2 py-1 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-black"
              >
                {showPapers ? 'Hide Inventory' : 'View Inventory'}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            {exam.question_paper_pdf && exam.question_paper_pdf.length > 100 ? (
              <button 
                onClick={() => openPdf(exam.question_paper_pdf)}
                className="flex-1 px-4 py-2 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-colors"
              >
                View QP
              </button>
            ) : (
              <div className="flex-1 px-4 py-2 bg-zinc-50 text-zinc-300 text-[10px] font-bold uppercase tracking-widest text-center">No QP</div>
            )}
            {exam.answer_key_pdf && exam.answer_key_pdf.length > 100 ? (
              <button 
                onClick={() => openPdf(exam.answer_key_pdf)}
                className="flex-1 px-4 py-2 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-colors"
              >
                View Key
              </button>
            ) : (
              <div className="flex-1 px-4 py-2 bg-zinc-50 text-zinc-300 text-[10px] font-bold uppercase tracking-widest text-center">No Key</div>
            )}
          </div>
        </div>
        
        <div className="p-8 md:w-1/2 bg-zinc-50 flex flex-col justify-between">
          <div className="space-y-4">
            <label className="block text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Automatic Distribution</label>
            <div className="flex gap-2">
              <select 
                value={selectedEvaluator}
                onChange={(e) => setSelectedEvaluator(e.target.value)}
                className="flex-1 p-3 bg-white border border-zinc-200 text-sm outline-none focus:border-zinc-900"
              >
                <option value="">Select Evaluator...</option>
                {evaluators.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
              <button 
                disabled={loading}
                onClick={handleDistribute}
                className="px-4 py-3 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-800 disabled:opacity-50"
              >
                Distribute
              </button>
            </div>
            <p className="text-[9px] text-zinc-400">All unassigned papers will be distributed to this evaluator.</p>
          </div>

          <div className="pt-8 space-y-4">
            <label className="block text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Upload & Auto-Assign</label>
            <div className="flex flex-col gap-3">
              <select 
                value={selectedEvaluator}
                onChange={(e) => setSelectedEvaluator(e.target.value)}
                className="w-full p-3 bg-white border border-zinc-200 text-sm outline-none focus:border-zinc-900"
              >
                <option value="">No Auto-Assignment (Manual later)</option>
                {evaluators.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
              
              <label className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-black transition-colors shadow-lg shadow-zinc-200">
                <Upload className="w-3 h-3" />
                {loading ? 'Processing Batch...' : 'Upload Student Scripts'}
                <input 
                  type="file" 
                  multiple 
                  accept=".pdf" 
                  className="hidden" 
                  disabled={loading}
                  onChange={(e) => handleBulkUpload(e.target.files)} 
                />
              </label>
            </div>
            {selectedEvaluator && (
              <p className="text-[9px] text-zinc-400 italic">Scripts will be automatically digitized and assigned to <span className="font-bold">{evaluators.find(e => e.id === selectedEvaluator)?.name}</span>.</p>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showPapers && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-zinc-100 bg-white overflow-hidden"
          >
            <div className="p-8">
              <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 mb-4">Student Script Inventory</h4>
              <div className="grid grid-cols-1 gap-4">
                {/* Manual Entry Form */}
                <div className="p-4 bg-zinc-900 border border-zinc-800 flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <input 
                      type="text" 
                      id={`student-name-${exam.id}`}
                      placeholder="Enter Student Name..." 
                      className="w-full p-2 bg-zinc-800 text-white text-xs border border-zinc-700 outline-none focus:border-white transition-all"
                    />
                  </div>
                  <label className="flex-1 flex items-center justify-center gap-2 bg-white text-zinc-900 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-zinc-100 transition-colors py-2">
                    <Plus className="w-3 h-3" />
                    Upload & Add Student
                    <input 
                      type="file" 
                      accept=".pdf" 
                      className="hidden" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        const nameInput = document.getElementById(`student-name-${exam.id}`) as HTMLInputElement;
                        const name = nameInput?.value || file?.name.replace('.pdf', '') || 'Unknown';
                        if (!file) return;
                        
                        setLoading(true);
                        const reader = new FileReader();
                        const base64 = await new Promise<string>((resolve) => {
                          reader.onload = () => resolve(reader.result as string);
                          reader.readAsDataURL(file);
                        });

                        const paperId = 'paper_' + Math.random().toString(36).substr(2, 9);
                        const paper = { id: paperId, student_name: name, pdf_base64: base64 };
                        
                        await api.uploadPapers(exam.id, [paper]);
                        
                        // Digitization
                        const answerKey = JSON.parse(exam.answer_key_json);
                        try {
                          const digitized = await aiService.processAnswerSheet(base64, answerKey);
                          await api.updatePaperEvaluation(paperId, {
                            digitized_text_json: JSON.stringify(digitized),
                            marks_json: '{}',
                            status: 'pending'
                          });
                        } catch (err) { console.error(err); }

                        // Auto-assign to current selection if any
                        if (selectedEvaluator) {
                          await api.assignPapers([paperId], selectedEvaluator);
                        }

                        if (nameInput) nameInput.value = '';
                        loadPapers();
                        setLoading(false);
                      }}
                    />
                  </label>
                </div>

                {papers.map(p => (
                  <div key={p.id} className="p-4 bg-zinc-50 border border-zinc-100 flex flex-col md:flex-row justify-between items-center group/item gap-4">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{p.student_name}</div>
                      <div className="text-[9px] font-mono text-zinc-300">ID: {p.id}</div>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <select 
                        value={p.assigned_to || ''}
                        onChange={async (e) => {
                          const evalId = e.target.value;
                          if (evalId) {
                            setLoading(true);
                            await processPapers([p.id]);
                            setLoading(false);
                          }
                          await api.assignPapers([p.id], evalId);
                          loadPapers();
                        }}
                        className="flex-1 md:w-48 p-2 bg-white border border-zinc-200 text-[10px] uppercase font-bold tracking-widest outline-none focus:border-zinc-900"
                      >
                        <option value="">Unassigned</option>
                        {evaluators.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                      </select>
                      
                      <div className={cn(
                        "text-[8px] font-bold uppercase px-2 py-1 border rounded-full shrink-0",
                        p.status === 'corrected' ? "bg-green-50 text-green-600 border-green-100" : "bg-orange-50 text-orange-600 border-orange-100"
                      )}>
                        {p.status === 'corrected' ? 'Audited' : 'Pending'}
                      </div>

                      <button 
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: p.id, type: 'paper' as any, title: p.student_name }); }}
                        className="p-2 text-zinc-300 hover:text-red-500 transition-all shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {papers.length === 0 && <div className="col-span-3 text-center py-8 text-zinc-300 font-serif italic text-sm">No scripts uploaded yet.</div>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
