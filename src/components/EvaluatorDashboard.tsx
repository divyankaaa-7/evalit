import { useState, useEffect } from 'react';
import { User, Paper, SegmentedAnswer, AnswerKeySection } from '../types';
import { api } from '../services/api';
import { aiService } from '../services/ai';
import { FileStack, ChevronLeft, ChevronRight, ExternalLink, CheckCircle2, AlertCircle, Save, ArrowLeft, X, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Timer = ({ seconds, minSeconds }: { seconds: number, minSeconds: number }) => {
  const remaining = Math.max(0, minSeconds - seconds);
  const isComplete = seconds >= minSeconds;

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn("flex items-center gap-2 px-4 py-1.5 border rounded-full font-mono text-sm shadow-sm transition-colors", isComplete ? "bg-green-50 border-green-200 text-green-700" : "bg-orange-50 border-orange-200 text-orange-700")}>
      <Clock className="w-4 h-4" />
      {isComplete ? "Time Requirement Met" : `Mandatory Review Time: ${formatTime(remaining)}`}
    </div>
  );
};

const MIN_EVAL_TIME = 60; // 60 seconds

export default function EvaluatorDashboard({ user }: { user: User }) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [digitizedAnswers, setDigitizedAnswers] = useState<SegmentedAnswer[]>([]);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [processing, setProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showOriginalPdf, setShowOriginalPdf] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (selectedPaper && !processing) {
      interval = setInterval(() => {
        setTimeSpent(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [selectedPaper, processing]);

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
    setTimeSpent(0);
    
    if (paper.digitized_text_json) {
      setDigitizedAnswers(JSON.parse(paper.digitized_text_json));
      setMarks(JSON.parse(paper.marks_json || '{}'));
    } else {
      setProcessing(true);
      try {
        const answerKey = JSON.parse(paper.answer_key_json || '[]') as AnswerKeySection[];
        const result = await aiService.processAnswerSheet(paper.pdf_base64, answerKey);
        setDigitizedAnswers(result);
        // Save initial digitization
        await api.updatePaperEvaluation(paper.id, {
          digitized_text_json: JSON.stringify(result),
          marks_json: '{}',
          status: 'evaluating'
        });
      } catch (e) {
        alert('Failed to process paper with AI. Please check your API key.');
        setSelectedPaper(null);
      } finally {
        setProcessing(false);
      }
    }
  };

  const confirmSaveEvaluation = async () => {
    if (!selectedPaper) return;
    try {
      await api.updatePaperEvaluation(selectedPaper.id, {
        digitized_text_json: JSON.stringify(digitizedAnswers),
        marks_json: JSON.stringify(marks),
        status: 'completed'
      });
      alert('Evaluation saved and stored successfully.');
      setShowConfirmation(false);
      setSelectedPaper(null);
      loadPapers();
    } catch (e) {
      alert('Failed to save evaluation.');
    }
  };

  const calculateScoreBreakdown = () => {
    if (!selectedPaper) return { breakdown: [], totalScore: 0, examMaxMarks: 0 };
    const answerKey = JSON.parse(selectedPaper.answer_key_json || '[]') as AnswerKeySection[];
    const examMaxMarks = selectedPaper.max_marks || Infinity;

    const grouped = new Map<string, any>();
    for (const q of answerKey) {
      const mainNum = q.mainQuestionNumber || q.questionNumber;
      if (!grouped.has(mainNum)) {
        grouped.set(mainNum, { mainQuestionNumber: mainNum, subQuestions: [], totalScore: 0, maxScore: 0, counted: false });
      }
      const group = grouped.get(mainNum)!;
      group.subQuestions.push(q.questionNumber);
      group.maxScore += q.maxMarks;
      group.totalScore += marks[q.questionNumber] || 0;
    }

    const breakdown = Array.from(grouped.values());
    breakdown.sort((a, b) => b.totalScore - a.totalScore); // Sort by highest marks first

    let accumulatedMax = 0;
    let finalScore = 0;

    for (const group of breakdown) {
      if (examMaxMarks === Infinity || accumulatedMax + group.maxScore <= examMaxMarks) {
        group.counted = true;
        accumulatedMax += group.maxScore;
        finalScore += group.totalScore;
      } else {
        group.counted = false;
      }
    }

    breakdown.sort((a, b) => a.mainQuestionNumber.localeCompare(b.mainQuestionNumber));
    return { breakdown, totalScore: finalScore, examMaxMarks: examMaxMarks !== Infinity ? examMaxMarks : accumulatedMax };
  };

  if (selectedPaper) {
    const currentAnswer = digitizedAnswers[currentQuestionIdx];
    const answerKey = JSON.parse(selectedPaper.answer_key_json || '[]') as AnswerKeySection[];
    const currentKeySection = answerKey.find(k => k.questionNumber === currentAnswer?.questionNumber);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4 relative">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedPaper(null)} className="p-2 hover:bg-zinc-100 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-medium">{selectedPaper.student_name}</h2>
              <p className="text-xs text-zinc-400 font-mono uppercase">{selectedPaper.exam_title}</p>
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
            <Timer seconds={timeSpent} minSeconds={MIN_EVAL_TIME} />
          </div>

          <div className="flex items-center gap-3 relative">
            <button 
              onClick={() => setShowOriginalPdf(!showOriginalPdf)}
              className="flex items-center gap-2 px-4 py-2 border border-zinc-200 text-sm hover:bg-zinc-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> {showOriginalPdf ? 'Close Original Copy' : 'Open Original Copy'}
            </button>
            <button 
              onClick={() => timeSpent >= MIN_EVAL_TIME && setShowConfirmation(true)}
              disabled={timeSpent < MIN_EVAL_TIME}
              className={cn("flex items-center gap-2 px-4 py-2 text-sm transition-colors", timeSpent >= MIN_EVAL_TIME ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-zinc-200 text-zinc-400 cursor-not-allowed")}
            >
              <Save className="w-4 h-4" /> {timeSpent >= MIN_EVAL_TIME ? "Mark as Completed" : `Reviewing (${Math.max(0, MIN_EVAL_TIME - timeSpent)}s)`}
            </button>

            <AnimatePresence>
              {showOriginalPdf && selectedPaper && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 z-50 bg-white w-[500px] h-[600px] shadow-2xl flex flex-col border border-zinc-300 rounded-md overflow-hidden origin-top-right"
                >
                  <div className="bg-zinc-100 flex justify-between items-center p-3 border-b border-zinc-300">
                    <h3 className="font-medium text-sm text-zinc-700 font-mono">Original Copy Preview</h3>
                    <button onClick={() => setShowOriginalPdf(false)} className="p-1 hover:bg-zinc-200 rounded"><X className="w-4 h-4"/></button>
                  </div>
                  <iframe src={selectedPaper.pdf_base64} className="flex-1 w-full border-none" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {processing ? (
          <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-zinc-400">
            <FileStack className="w-12 h-12 animate-pulse" />
            <p className="font-mono text-sm animate-pulse">AI is digitizing and segmenting answer sheet...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Key Points */}
            <div className="lg:col-span-3 h-[70vh]">
              <div className="bg-white border border-zinc-200 p-6 shadow-sm h-full flex flex-col">
                <h4 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-4">Required Key Points</h4>
                <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                  {currentAnswer?.matches.map((m, idx) => (
                    <div key={idx} className={cn(
                      "p-3 text-xs flex items-start gap-2 border transition-colors",
                      m.found ? "bg-green-50 border-green-100 text-green-700" : "bg-red-50 border-red-100 text-red-700"
                    )}>
                      {m.found ? <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />}
                      <span>{m.point}</span>
                    </div>
                  ))}
                  {(!currentAnswer?.matches || currentAnswer.matches.length === 0) && (
                    <p className="text-xs text-zinc-400 italic">No specific points defined in key.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Middle: Digitized Output Area */}
            <div className="lg:col-span-6 flex flex-col h-[70vh]">
              <div className="flex-1 overflow-y-auto bg-white border border-zinc-200 p-8 shadow-sm">
                <div className="flex justify-between items-start mb-8">
                  <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400">Digitized Transcript</div>
                  <div className="text-xl font-serif italic text-zinc-900">{currentAnswer?.questionNumber || 'Question Not Found'}</div>
                </div>
                
                <div className="prose prose-zinc prose-sm max-w-none text-zinc-800 font-sans">
                  {currentAnswer?.text ? (
                    <ReactMarkdown>{currentAnswer.text}</ReactMarkdown>
                  ) : (
                    "No digitizable text found for this section."
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between bg-zinc-900 text-white p-4">
                <button 
                  onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
                  disabled={currentQuestionIdx === 0}
                  className="flex items-center gap-2 text-xs uppercase tracking-widest disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <div className="text-xs uppercase tracking-widest font-mono">
                  {currentQuestionIdx + 1} / {digitizedAnswers.length}
                </div>
                <button 
                  onClick={() => setCurrentQuestionIdx(prev => Math.min(digitizedAnswers.length - 1, prev + 1))}
                  disabled={currentQuestionIdx === digitizedAnswers.length - 1}
                  className="flex items-center gap-2 text-xs uppercase tracking-widest disabled:opacity-30"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Right: Navigation & Marking Panel */}
            <div className="lg:col-span-3 h-[70vh]">
              <div className="bg-white border border-zinc-200 shadow-sm h-full flex flex-col">
                <div className="p-4 border-b border-zinc-200 bg-zinc-50">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-zinc-900">Question Navigator</h4>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {digitizedAnswers.map((ans, idx) => {
                    const keySec = answerKey.find(k => k.questionNumber === ans.questionNumber);
                    const max = keySec?.maxMarks || 0;
                    const isCurrent = idx === currentQuestionIdx;
                    return (
                      <div key={idx} 
                           onClick={() => setCurrentQuestionIdx(idx)}
                           className={cn(
                             "p-4 border-b border-zinc-100 cursor-pointer flex items-center justify-between hover:bg-zinc-50 transition-colors", 
                             isCurrent ? "bg-zinc-100 border-l-4 border-l-zinc-900" : "border-l-4 border-l-transparent"
                           )}>
                        <span className="font-mono font-bold">
                          {ans.questionNumber.toLowerCase().startsWith('q') ? ans.questionNumber : `Q${ans.questionNumber}`}
                        </span>
                        <input 
                          type="number"
                          min="0"
                          onClick={(e) => e.stopPropagation()}
                          max={max}
                          value={marks[ans.questionNumber] ?? ''}
                          placeholder={`/${max}`}
                          onChange={(e) => {
                            let valStr = e.target.value;
                            if (valStr === '') {
                              const newMarks = { ...marks };
                              delete newMarks[ans.questionNumber];
                              setMarks(newMarks);
                            } else {
                              const val = Math.max(0, Math.min(parseInt(valStr) || 0, max));
                              setMarks({ ...marks, [ans.questionNumber]: val });
                            }
                          }}
                          className="w-16 p-2 border border-zinc-200 text-center font-mono text-sm focus:border-zinc-900 outline-none"
                        />
                      </div>
                    )
                  })}
                </div>
                <div className="p-4 bg-zinc-900 text-white flex justify-between items-center">
                  <span className="text-[10px] uppercase tracking-widest">Progress</span>
                  <span className="font-mono text-sm">{Object.keys(marks).length} / {digitizedAnswers.length}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {showConfirmation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white max-w-2xl w-full p-8 shadow-xl max-h-[90vh] overflow-y-auto"
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-serif italic mb-1">Marks Division Summary</h2>
                    <p className="text-sm text-zinc-500">Review the score breakdown before finalizing.</p>
                  </div>
                  <button onClick={() => setShowConfirmation(false)} className="p-2 hover:bg-zinc-100 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="border border-zinc-200 mb-6">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="px-4 py-3 font-medium text-zinc-500">Main Question</th>
                        <th className="px-4 py-3 font-medium text-zinc-500">Sub-questions</th>
                        <th className="px-4 py-3 font-medium text-zinc-500 text-right">Score</th>
                        <th className="px-4 py-3 font-medium text-zinc-500 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {calculateScoreBreakdown().breakdown.map((group: any, idx: number) => (
                        <tr key={idx} className={group.counted ? 'bg-white' : 'bg-red-50 text-red-800 opacity-60'}>
                          <td className="px-4 py-3 font-bold font-mono">
                            {group.mainQuestionNumber.toLowerCase().startsWith('q') ? group.mainQuestionNumber : `Q${group.mainQuestionNumber}`}
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-500">{group.subQuestions.join(', ')}</td>
                          <td className="px-4 py-3 text-right font-mono">
                            {group.totalScore} / {group.maxScore}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {group.counted ? (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                                <CheckCircle2 className="w-3 h-3" /> Counted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-red-600">
                                Extra Question
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between p-6 bg-zinc-900 text-white mb-8">
                  <div className="text-sm uppercase tracking-widest opacity-60">Final Best Score</div>
                  <div className="text-4xl font-serif italic">
                    {calculateScoreBreakdown().totalScore} <span className="text-xl opacity-50">/ {calculateScoreBreakdown().examMaxMarks}</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowConfirmation(false)}
                    className="flex-1 px-4 py-3 border border-zinc-200 font-medium hover:bg-zinc-50 transition-colors"
                  >
                    Back to Evaluation
                  </button>
                  <button 
                    onClick={confirmSaveEvaluation}
                    className="flex-1 px-4 py-3 bg-zinc-900 text-white font-medium hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" /> Confirm and Submit Score
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900 text-white p-8">
          <div className="text-4xl font-serif italic mb-2">{papers.length}</div>
          <div className="text-xs uppercase tracking-[0.2em] opacity-60">Pending Evaluations</div>
        </div>
        <div className="bg-white border border-zinc-200 p-8">
          <div className="text-4xl font-serif italic mb-2">{papers.filter(p => p.status === 'completed').length}</div>
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Successfully Completed</div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium font-serif italic">Your Assignment Desk</h3>
        <div className="overflow-hidden border border-zinc-200 bg-white">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Student Name</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Exam Module</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Status</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-zinc-400 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {papers.map((paper) => (
                <tr key={paper.id} className="hover:bg-zinc-50 transition-colors group">
                  <td className="px-6 py-4 font-medium text-zinc-900">{paper.student_name}</td>
                  <td className="px-6 py-4 text-sm text-zinc-500">{paper.exam_title}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "text-[9px] uppercase tracking-widest font-bold px-2 py-1 rounded-full",
                      paper.status === 'completed' ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"
                    )}>
                      {paper.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => startEvaluation(paper)}
                      className="text-xs font-bold uppercase tracking-widest text-zinc-400 group-hover:text-zinc-900 transition-colors"
                    >
                      {paper.status === 'completed' ? 'Review' : 'Begin Evaluation'}
                    </button>
                  </td>
                </tr>
              ))}
              {papers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-400 italic text-sm">
                    No answer sheets assigned to you currently.
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
