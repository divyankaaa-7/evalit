import { useState, useEffect } from 'react';
import { Paper, User, AnswerKeySection, SegmentedAnswer } from '../types';
import { api } from '../services/api';
import { FileStack, CheckCircle2, FileText, ToggleLeft, ToggleRight, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';

interface EvaluatorDashboardProps {
  user: User;
}

export default function EvaluatorDashboard({ user }: EvaluatorDashboardProps) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [digitizedAnswers, setDigitizedAnswers] = useState<SegmentedAnswer[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [remarks, setRemarks] = useState<string>('');
  const [viewMode, setViewMode] = useState<'digital' | 'original'>('digital');

  useEffect(() => {
    loadPapers();
  }, [user.id]);

  const loadPapers = async () => {
    const data = await api.getEvaluatorPapers(user.id);
    setPapers(data);
  };

  const startEvaluation = async (paper: Paper) => {
    setSelectedPaper(paper);
    setCurrentQuestionIdx(0);
    setRemarks(paper.remarks || '');
    setViewMode('digital');
    
    // Safely parse remarks
    try {
      // Question-specific remarks removed as per user request
    } catch (e) {
      // No-op
    }

    // Safely parse digitized text
    try {
      if (paper.digitized_text_json && paper.digitized_text_json !== 'null') {
        const parsedDigitized = JSON.parse(paper.digitized_text_json);
        setDigitizedAnswers(Array.isArray(parsedDigitized) ? parsedDigitized : []);
      } else {
        alert("This script has not been digitized yet. Please contact the administrator.");
        setDigitizedAnswers([]);
      }
    } catch (e) {
      alert("Error: The digitized text for this script is corrupted and cannot be displayed.");
      setDigitizedAnswers([]);
    }

    // Safely parse marks
    try {
      setMarks(paper.marks_json && paper.marks_json !== 'null' ? JSON.parse(paper.marks_json) : {});
    } catch (e) {
      setMarks({});
    }
  };

  const saveEvaluation = async () => {
    if (!selectedPaper) return;

    const answerKey = JSON.parse(selectedPaper.answer_key_json || '[]') as AnswerKeySection[];
    const totalMarks = Object.values(marks).reduce((a, b) => a + b, 0);

    const allQuestionsMarked = answerKey.every(k => marks[k.questionNumber] !== undefined);
    const status = allQuestionsMarked ? 'corrected' : 'pending';

    if (!confirm(`Confirm submission? Total marks: ${totalMarks}. Status will be set to: ${status.toUpperCase()}`)) return;

    await api.updatePaperEvaluation(selectedPaper.id, {
      marks_json: JSON.stringify(marks),
      remarks: remarks,
      remarks_json: '{}',
      status
    });

    alert("Evaluation saved!");
    setSelectedPaper(null);
    loadPapers();
  };

  if (selectedPaper) {
    const answerKey = JSON.parse(selectedPaper.answer_key_json || '[]') as AnswerKeySection[];
    
    // Determine the list of questions for the scoring console
    const scoringQuestions = answerKey.length > 0 
      ? answerKey.map(k => ({ id: k.questionNumber, max: k.maxMarks }))
      : digitizedAnswers.map(ans => ({ id: ans.questionNumber, max: 100 })); // Default max if extracted by AI

    const currentQuestionNumber = scoringQuestions[currentQuestionIdx]?.id;
    const currentAnswer = digitizedAnswers.find(ans => ans.questionNumber === currentQuestionNumber);

    return (
      <div className="h-[calc(100vh-100px)] flex flex-col gap-4 overflow-hidden">
        {/* Header with Toggle */}
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3 bg-white px-4 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedPaper(null)}
              className="text-xs uppercase font-bold tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors"
            >
              ← Back to Queue
            </button>
            <div className="h-4 w-[1px] bg-zinc-200" />
            <h2 className="text-xl font-serif italic">{selectedPaper.student_name}'s Script</h2>
            <span className="text-[10px] font-mono bg-zinc-100 px-2 py-1 text-zinc-500 rounded-sm">
              {selectedPaper.exam_title}
            </span>
          </div>

          <div className="flex items-center gap-4 border border-zinc-200 rounded-full p-1 bg-zinc-50">
            <button
              onClick={() => setViewMode('digital')}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
                viewMode === 'digital' ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              <ToggleLeft className={cn("w-4 h-4", viewMode === 'digital' ? "text-zinc-900" : "text-zinc-300")} />
              Digital
            </button>
            <button
              onClick={() => setViewMode('original')}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
                viewMode === 'original' ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              Original PDF
              <ToggleRight className={cn("w-4 h-4", viewMode === 'original' ? "text-zinc-900" : "text-zinc-300")} />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[8px] text-zinc-400 uppercase font-bold tracking-[0.2em]">Live Score</span>
              <span className="text-xl font-serif italic text-zinc-900">{Object.values(marks).reduce((a, b) => a + b, 0)}</span>
            </div>
            <button 
              onClick={saveEvaluation}
              className="px-8 py-3 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-black transition-all shadow-xl shadow-zinc-200 active:scale-95"
            >
              Final Submit • {Object.values(marks).reduce((a, b) => a + b, 0)} Pts
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-12 gap-4 overflow-hidden p-4 bg-zinc-50">
          {/* Left Panel: Answer Key */}
          <div className="col-span-3 bg-white border border-zinc-200 flex flex-col overflow-hidden shadow-sm">
            <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
              <h4 className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Official Marking Scheme</h4>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {answerKey.length > 0 ? (
                answerKey.map((key) => (
                  <div key={key.id} className={cn(
                    "p-4 bg-zinc-50 border border-zinc-100 border-l-4 transition-all",
                    currentQuestionNumber === key.questionNumber ? "border-l-zinc-900 bg-white" : "border-l-transparent"
                  )}>
                    <div className="flex justify-between text-xs font-bold mb-3">
                      <span className="text-zinc-900">{key.questionNumber}</span>
                      <span className="text-zinc-400">Max: {key.maxMarks} pts</span>
                    </div>
                    <ul className="space-y-2">
                      {key.points.map((p, i) => (
                        <li key={i} className="text-xs text-zinc-600 flex items-start gap-2">
                          <span className="w-1 h-1 rounded-full bg-zinc-300 mt-1.5 shrink-0" />
                          <span className="leading-relaxed">{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : selectedPaper.answer_key_pdf ? (
                <div className="h-full w-full bg-zinc-100">
                  <iframe src={selectedPaper.answer_key_pdf} className="w-full h-full border-none" title="Answer Key PDF" />
                </div>
              ) : (
                <div className="text-center py-20 text-zinc-400 font-serif italic text-sm">
                  No answer key provided.
                </div>
              )}
            </div>
          </div>

          {/* Center Panel: Digitized Script */}
          <div className="col-span-6 bg-white border border-zinc-200 flex flex-col overflow-hidden shadow-sm relative">
            <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-3 h-3 text-zinc-400" />
                <h4 className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                  {viewMode === 'digital' ? 'Digitized Output' : 'Original Document'}
                </h4>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {viewMode === 'digital' ? (
                <div className="space-y-6">
                  {digitizedAnswers.length > 0 ? (
                    digitizedAnswers.map((ans, i) => (
                      <div key={i} className="mb-6 pb-6 border-b border-zinc-100 last:border-0">
                        <h5 className="font-serif italic text-lg mb-3 flex items-center gap-2">
                          <span className="text-zinc-400">Answer</span> {ans.questionNumber}
                        </h5>
                        <div className="text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap font-sans">
                          {ans.text}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-20 text-zinc-400 font-serif italic">
                      The AI could not identify any answers in this document. 
                    </div>
                  )}
                  {currentAnswer?.matches && currentAnswer.matches.length > 0 && (
                    <div className="mt-16 p-8 bg-zinc-50 border border-dashed border-zinc-200">
                      <h5 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-6 border-b border-zinc-100 pb-2">Pattern Matching Results</h5>
                      <div className="grid grid-cols-1 gap-4">
                        {currentAnswer.matches.map((m, i) => (
                          <div key={i} className="flex gap-4 items-center text-xs">
                            <div className={cn("w-2 h-2 rounded-full", m.found ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-zinc-200")} />
                            <span className={cn("flex-1", m.found ? "text-zinc-900 font-medium" : "text-zinc-400")}>{m.point}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full w-full bg-zinc-100 flex items-center justify-center p-4">
                  <iframe
                    src={selectedPaper.pdf_base64}
                    className="w-full h-full border-none shadow-2xl bg-white"
                    title="Original Paper"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Scoring Console */}
          <div className="col-span-3 flex flex-col gap-4 overflow-hidden">
            <div className="flex-1 bg-zinc-900 border border-zinc-800 flex flex-col overflow-hidden shadow-xl text-white">
              <div className="p-4 border-b border-zinc-800 bg-black/20">
                <h4 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Question Navigation & Marks</h4>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {scoringQuestions.map((key, idx) => {
                  const isMarked = marks[key.id] !== undefined;
                  const isActive = currentQuestionIdx === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => { setCurrentQuestionIdx(idx); setViewMode('digital'); }}
                      className={cn(
                        "p-4 border transition-all cursor-pointer relative group",
                        isActive ? "border-zinc-700 bg-zinc-800 text-white shadow-md" : "border-zinc-800 bg-transparent hover:bg-zinc-800/50"
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className={cn("text-xs font-bold uppercase tracking-widest", isActive ? "text-white" : "text-zinc-500")}>
                          {key.id}
                        </span>
                        {isMarked && (
                          <CheckCircle2 className={cn("w-3 h-3", isActive ? "text-white/40" : "text-green-500")} />
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <input 
                          type="number"
                          max={key.max}
                          placeholder="0"
                          value={marks[key.id] ?? ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const val = Math.min(parseInt(e.target.value) || 0, key.max);
                            setMarks({ ...marks, [key.id]: val });
                          }}
                          className={cn(
                            "w-20 p-2 text-center text-sm font-bold border-none outline-none rounded-sm transition-colors",
                            isActive ? "bg-white/10 text-white placeholder:text-white/30" : "bg-black/40 text-white"
                          )}
                        />
                        <span className={cn("text-[10px] font-mono shrink-0", isActive ? "text-white/40" : "text-zinc-500")}>
                          / {key.max === 100 ? '?' : key.max}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Overall Remarks Panel */}
            <div className="h-1/3 bg-white border border-zinc-200 flex flex-col overflow-hidden shadow-sm">
              <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-2">
                <MessageSquare className="w-3 h-3 text-zinc-400" />
                <h4 className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Evaluator Remarks</h4>
              </div>
              <div className="flex-1 p-4">
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Provide overall feedback or justification for marks..."
                  className="w-full h-full p-4 bg-zinc-50 border border-zinc-100 text-xs outline-none focus:bg-white focus:border-zinc-900 resize-none transition-all font-sans leading-relaxed shadow-inner"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-zinc-900 p-12 text-white relative overflow-hidden group shadow-2xl">
          <div className="absolute -right-8 -bottom-8 opacity-5 group-hover:scale-110 group-hover:-rotate-12 transition-all duration-700">
            <FileStack className="w-48 h-48" />
          </div>
          <div className="relative z-10">
            <div className="text-6xl font-serif italic mb-4">{papers.length}</div>
            <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-zinc-400">Current Assignment Queue</div>
          </div>
        </div>
        <div className="bg-white border border-zinc-200 p-12 relative overflow-hidden shadow-sm">
          <div className="text-6xl font-serif italic mb-4 text-zinc-300">{papers.filter(p => p.status === 'corrected').length}</div>
          <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-zinc-400">Total Scripts Audited</div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <h3 className="text-2xl font-serif italic text-zinc-900">Assigned Answer Scripts</h3>
          <div className="px-3 py-1 bg-zinc-50 border border-zinc-100 rounded-full text-[9px] uppercase font-bold text-zinc-400 tracking-widest">
            {papers.length} scripts remaining
          </div>
        </div>

        <div className="bg-white border border-zinc-200 shadow-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400">
                <th className="px-10 py-6">Identity</th>
                <th className="px-10 py-6">Subject Module</th>
                <th className="px-10 py-6">Current Status</th>
                <th className="px-10 py-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {papers.map((paper) => (
                <tr key={paper.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-10 py-8">
                    <div className="font-medium text-zinc-900 text-lg">{paper.student_name}</div>
                    <div className="text-[10px] font-mono text-zinc-300 uppercase mt-1">ID: {paper.id}</div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="text-base font-serif italic text-zinc-600">{paper.exam_title}</div>
                  </td>
                  <td className="px-10 py-8">
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-widest px-3 py-1 border rounded-full",
                      paper.status === 'corrected' ? "bg-green-50 text-green-600 border-green-100" : "bg-orange-50 text-orange-600 border-orange-100"
                    )}>
                      {paper.status === 'corrected' ? 'Audited' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <button
                      onClick={() => startEvaluation(paper)}
                      className="px-6 py-3 bg-white border border-zinc-200 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition-all shadow-sm"
                    >
                      {paper.status === 'corrected' ? 'Re-Audit Script' : 'Begin Evaluation'}
                    </button>
                  </td>
                </tr>
              ))}
              {papers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-10 py-32 text-center text-zinc-300 font-serif italic text-xl">
                    Your desk is currently clear of any script assignments.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
