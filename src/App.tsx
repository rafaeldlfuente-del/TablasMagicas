/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { 
  Trophy, 
  RotateCcw, 
  Home, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  Star,
  Sparkles,
  Smartphone,
  RotateCw,
  GraduationCap,
  BookOpen,
  ArrowLeft
} from 'lucide-react';

type Step = 'setup' | 'quiz' | 'results' | 'learn';
type Mode = 'order' | 'random';

const APP_VERSION = '1.0.3'; // Increment this to force a reload

interface Question {
  a: number;
  b: number;
  correct: number;
}

interface ErrorRecord {
  question: string;
  correct: number;
  user: number;
}

export default function App() {
  const [step, setStep] = useState<Step>('setup');
  const [learningTable, setLearningTable] = useState<number | null>(null);

  // PWA Update logic
  useRegisterSW({
    onRegistered(r) {
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000); // Check for updates every hour
      }
    },
    onNeedRefresh() {
      if (window.confirm('¡Hay una nueva versión disponible! ¿Quieres actualizar ahora?')) {
        window.location.reload();
      }
    },
  });

  // Version check fallback
  useEffect(() => {
    const savedVersion = localStorage.getItem('app_version');
    if (savedVersion && savedVersion !== APP_VERSION) {
      localStorage.setItem('app_version', APP_VERSION);
      window.location.reload();
    } else if (!savedVersion) {
      localStorage.setItem('app_version', APP_VERSION);
    }
  }, []);
  const [selectedTables, setSelectedTables] = useState<number[]>([]);
  const [mode, setMode] = useState<Mode>('order');
  const [isTimedMode, setIsTimedMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [score, setScore] = useState(0);
  const [errors, setErrors] = useState<ErrorRecord[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'incorrect'; message: string; correctAnswer?: number } | null>(null);
  const [isRetryingErrors, setIsRetryingErrors] = useState(false);
  const [autoAdvanceSeconds, setAutoAdvanceSeconds] = useState(2);
  const [highScore, setHighScore] = useState<number>(() => {
    const saved = localStorage.getItem('tablasMagicasHighScore');
    return saved ? parseInt(saved) : 0;
  });

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input automatically
  useEffect(() => {
    if (step === 'quiz' && !feedback) {
      inputRef.current?.focus();
    }
  }, [step, feedback, currentIndex]);

  // Timer logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'quiz' && isTimedMode && !feedback && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && !feedback && step === 'quiz') {
      handleTimeOut();
    }

    return () => clearInterval(timer);
  }, [step, isTimedMode, feedback, timeLeft]);

  // Auto-advance logic
  useEffect(() => {
    let autoAdvanceTimer: NodeJS.Timeout;
    let countdownInterval: NodeJS.Timeout;
    
    if (feedback && step === 'quiz') {
      setAutoAdvanceSeconds(2);
      countdownInterval = setInterval(() => {
        setAutoAdvanceSeconds(prev => Math.max(0, prev - 1));
      }, 1000);
      
      autoAdvanceTimer = setTimeout(() => {
        nextQuestion();
      }, 2000);
    }
    
    return () => {
      clearTimeout(autoAdvanceTimer);
      clearInterval(countdownInterval);
    };
  }, [feedback, step]);

  const handleTimeOut = () => {
    const currentQ = questions[currentIndex];
    const record: ErrorRecord = {
      question: `${currentQ.a} × ${currentQ.b}`,
      correct: currentQ.correct,
      user: -1 // Indicates timeout
    };
    setErrors(prev => [...prev, record]);
    setFeedback({ 
      type: 'incorrect', 
      message: '¡Se acabó el tiempo! ⏰',
      correctAnswer: currentQ.correct
    });
  };

  const startQuiz = (tables: number[], quizMode: Mode) => {
    let qList: Question[] = [];
    tables.forEach(table => {
      for (let i = 1; i <= 9; i++) {
        qList.push({ a: table, b: i, correct: table * i });
      }
    });

    if (quizMode === 'random') {
      for (let i = qList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qList[i], qList[j]] = [qList[j], qList[i]];
      }
    }

    setQuestions(qList);
    setSelectedTables(tables);
    setMode(quizMode);
    setCurrentIndex(0);
    setScore(0);
    setErrors([]);
    setStep('quiz');
    setFeedback(null);
    setUserInput('');
    setIsRetryingErrors(false);
    setTimeLeft(10);
  };

  const startRetryErrors = () => {
    let retryQuestions: Question[] = errors.map(err => {
      const [a, b] = err.question.split(' × ').map(n => parseInt(n));
      return { a, b, correct: err.correct };
    });

    if (mode === 'random') {
      for (let i = retryQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [retryQuestions[i], retryQuestions[j]] = [retryQuestions[j], retryQuestions[i]];
      }
    }

    setQuestions(retryQuestions);
    setCurrentIndex(0);
    setScore(0);
    setErrors([]);
    setStep('quiz');
    setFeedback(null);
    setUserInput('');
    setIsRetryingErrors(true);
    setTimeLeft(10);
  };

  const handleAnswer = (val?: string) => {
    const inputToTest = val !== undefined ? val : userInput;
    if (inputToTest.trim() === '') return;

    const currentQ = questions[currentIndex];
    const userAns = parseInt(inputToTest);
    const isCorrect = userAns === currentQ.correct;

    if (isCorrect) {
      setScore(prev => prev + 1);
      setFeedback({ type: 'correct', message: '¡Excelente! 🌟' });
    } else {
      const record: ErrorRecord = {
        question: `${currentQ.a} × ${currentQ.b}`,
        correct: currentQ.correct,
        user: userAns
      };
      setErrors(prev => [...prev, record]);
      setFeedback({ 
        type: 'incorrect', 
        message: '¡Casi! Inténtalo de nuevo.',
        correctAnswer: currentQ.correct
      });
    }
  };

  const nextQuestion = () => {
    setFeedback(null);
    setUserInput('');
    setTimeLeft(10);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Check for high score
      if (score + (feedback?.type === 'correct' ? 1 : 0) > highScore) {
        const newHigh = score + (feedback?.type === 'correct' ? 1 : 0);
        setHighScore(newHigh);
        localStorage.setItem('tablasMagicasHighScore', newHigh.toString());
      }
      setStep('results');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (feedback) {
        nextQuestion();
      } else {
        handleAnswer();
      }
    }
  };

  const toggleTable = (num: number) => {
    setSelectedTables(prev => 
      prev.includes(num) 
        ? prev.filter(t => t !== num) 
        : [...prev, num].sort((a, b) => a - b)
    );
  };

  const tableColors = [
    'bg-rose-100 text-rose-600 border-rose-300 hover:bg-rose-200',
    'bg-orange-100 text-orange-600 border-orange-300 hover:bg-orange-200',
    'bg-amber-100 text-amber-600 border-amber-300 hover:bg-amber-200',
    'bg-emerald-100 text-emerald-600 border-emerald-300 hover:bg-emerald-200',
    'bg-teal-100 text-teal-600 border-teal-300 hover:bg-teal-200',
    'bg-cyan-100 text-cyan-600 border-cyan-300 hover:bg-cyan-200',
    'bg-sky-100 text-sky-600 border-sky-300 hover:bg-sky-200',
    'bg-indigo-100 text-indigo-600 border-indigo-300 hover:bg-indigo-200',
    'bg-violet-100 text-violet-600 border-violet-300 hover:bg-violet-200',
  ];

  const tableSelectedColors = [
    'bg-rose-500 text-white border-rose-700 shadow-rose-200',
    'bg-orange-500 text-white border-orange-700 shadow-orange-200',
    'bg-amber-500 text-white border-amber-700 shadow-amber-200',
    'bg-emerald-500 text-white border-emerald-700 shadow-emerald-200',
    'bg-teal-500 text-white border-teal-700 shadow-teal-200',
    'bg-cyan-500 text-white border-cyan-700 shadow-cyan-200',
    'bg-sky-500 text-white border-sky-700 shadow-sky-200',
    'bg-indigo-500 text-white border-indigo-700 shadow-indigo-200',
    'bg-violet-500 text-white border-violet-700 shadow-violet-200',
  ];

  return (
    <div className="h-[100dvh] w-full bg-gradient-to-br from-indigo-50 via-white to-pink-50 font-sans text-slate-800 p-4 flex flex-col items-center justify-center overflow-hidden select-none">
      <div className="w-full h-full flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
        {step === 'setup' && (
          <motion.div 
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-4xl w-full h-full md:max-h-[92dvh] bg-white rounded-3xl md:rounded-[3rem] shadow-2xl p-4 md:p-6 lg:p-8 border-4 md:border-8 border-indigo-100 flex flex-col overflow-hidden landscape:max-w-7xl landscape:h-[92vh]"
          >
            <div className="flex flex-col landscape:flex-row h-full gap-4 md:gap-6">
              {/* Left Column: Title & Modes */}
              <div className="flex flex-col landscape:w-[40%] h-full overflow-y-auto custom-scrollbar pr-1">
                <div className="text-center landscape:text-left mb-3 md:mb-6 flex-shrink-0">
                  <motion.div
                    initial={{ scale: 0.8, rotate: -5 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  >
                    <h1 className="text-2xl md:text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 mb-1 tracking-tight drop-shadow-sm">
                      ¡Tablas Mágicas! 🪄
                    </h1>
                  </motion.div>
                  <div className="flex items-center justify-center landscape:justify-start gap-2">
                    <p className="text-sm md:text-lg text-slate-400 font-medium italic">¡Aprender es una aventura! ✨</p>
                    <span className="text-[10px] md:text-xs font-mono text-slate-300 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">v{APP_VERSION}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 md:gap-4 flex-1 justify-center">
                  <div className="bg-slate-50 p-2 md:p-4 rounded-xl md:rounded-2xl border-2 border-slate-100 shadow-inner">
                    <h3 className="text-[10px] md:text-xs font-black text-slate-500 mb-2 md:mb-3 uppercase tracking-widest text-center landscape:text-left">Modo de Juego</h3>
                    <div className="flex flex-row gap-2 md:gap-3">
                      <button
                        onClick={() => setMode('order')}
                        className={`flex-1 py-2 md:py-3 px-2 rounded-xl md:rounded-2xl text-xs md:text-lg font-black transition-all border-b-2 md:border-b-4 ${
                          mode === 'order' 
                            ? 'bg-emerald-400 text-white border-emerald-600 shadow-lg -translate-y-0.5' 
                            : 'bg-white text-slate-400 border-slate-100'
                        }`}
                      >
                        Orden 📏
                      </button>
                      <button
                        onClick={() => setMode('random')}
                        className={`flex-1 py-2 md:py-3 px-2 rounded-xl md:rounded-2xl text-xs md:text-lg font-black transition-all border-b-2 md:border-b-4 ${
                          mode === 'random' 
                            ? 'bg-violet-400 text-white border-violet-600 shadow-lg -translate-y-0.5' 
                            : 'bg-white text-slate-400 border-slate-100'
                        }`}
                      >
                        Azar 🎲
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2 md:p-4 rounded-xl md:rounded-2xl border-2 border-slate-100 shadow-inner">
                    <button
                      onClick={() => setIsTimedMode(!isTimedMode)}
                      className={`w-full py-2 md:py-3 px-4 rounded-xl md:rounded-2xl text-xs md:text-lg font-black transition-all border-b-2 md:border-b-4 flex items-center justify-center gap-2 md:gap-3 ${
                        isTimedMode 
                          ? 'bg-rose-400 text-white border-rose-600 shadow-lg -translate-y-0.5' 
                          : 'bg-white text-slate-400 border-slate-100'
                      }`}
                    >
                      {isTimedMode ? 'Con Tiempo ⏰' : 'Sin Tiempo ⏳'}
                    </button>
                  </div>

                  <div className="bg-slate-50 p-2 md:p-4 rounded-xl md:rounded-2xl border-2 border-slate-100 shadow-inner">
                    <button
                      onClick={() => setStep('learn')}
                      className="w-full py-2 md:py-3 px-4 rounded-xl md:rounded-2xl text-xs md:text-lg font-black transition-all border-b-2 md:border-b-4 flex items-center justify-center gap-2 md:gap-3 bg-sky-400 text-white border-sky-600 shadow-lg hover:bg-sky-500 -translate-y-0.5"
                    >
                      <BookOpen className="w-4 h-4 md:w-5 md:h-5" />
                      Aprendizaje 📚
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-2">
                  <motion.button
                    whileHover={selectedTables.length > 0 ? { scale: 1.02 } : {}}
                    whileTap={selectedTables.length > 0 ? { scale: 0.98 } : {}}
                    disabled={selectedTables.length === 0}
                    onClick={() => selectedTables.length > 0 && startQuiz(selectedTables, mode)}
                    className={`
                      w-full py-2 md:py-4 lg:py-5 rounded-xl md:rounded-3xl text-lg md:text-3xl font-black transition-all shadow-xl border-b-4 md:border-b-8
                      ${selectedTables.length > 0 
                        ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white border-orange-600 hover:from-orange-500 hover:to-amber-500' 
                        : 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                      }
                    `}
                  >
                    ¡A JUGAR! 🚀
                  </motion.button>
                </div>
              </div>

              {/* Right Column: Table Grid */}
              <div className="flex flex-col landscape:w-[60%] h-full overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-end mb-2 md:mb-4">
                  <h2 className="text-lg md:text-xl font-black text-slate-700">Elige tus tablas:</h2>
                  {selectedTables.length > 0 && (
                    <button 
                      onClick={() => setSelectedTables([])}
                      className="text-[10px] md:text-xs font-bold text-rose-400 hover:text-rose-500 transition-colors flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3 md:w-4 md:h-4" /> Limpiar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 md:gap-3 flex-1 min-h-0 p-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num, idx) => (
                    <motion.button
                      key={num}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleTable(num)}
                      className={`
                        h-full min-h-[40px] md:h-auto text-3xl md:text-5xl lg:text-6xl font-black rounded-xl md:rounded-2xl transition-all border-b-4 md:border-b-8
                        ${selectedTables.includes(num) 
                          ? `${tableSelectedColors[idx]} shadow-lg -translate-y-0.5` 
                          : `${tableColors[idx]} border-slate-200`
                        }
                      `}
                    >
                      {num}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'quiz' && questions.length > 0 && (
          <motion.div 
            key="quiz"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="max-w-4xl w-full h-full md:max-h-[92dvh] bg-white rounded-3xl md:rounded-[3rem] shadow-2xl p-4 md:p-6 lg:p-8 border-4 md:border-8 border-amber-100 relative overflow-hidden flex flex-col landscape:max-w-7xl landscape:h-[92vh]"
          >
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-2 md:h-3 bg-slate-50">
              <motion.div 
                className="h-full bg-gradient-to-r from-amber-300 to-orange-400"
                initial={{ width: 0 }}
                animate={{ width: `${((currentIndex) / questions.length) * 100}%` }}
              />
            </div>

            <div className="flex justify-between items-center mb-4 md:mb-6 pt-2 md:pt-4 flex-shrink-0">
              <button 
                onClick={() => setStep('setup')}
                className="p-2 md:p-3 bg-white text-slate-400 rounded-xl md:rounded-2xl hover:bg-slate-50 transition-all border-b-2 md:border-b-4 border-slate-100 active:translate-y-1 active:border-b-0 shadow-sm"
                title="Volver al inicio"
              >
                <Home className="w-5 h-5 md:w-8 md:h-8" />
              </button>
              <div className="flex gap-2 md:gap-4 items-center">
                <div className="bg-amber-50 text-amber-600 px-3 py-1.5 md:px-6 md:py-3 rounded-lg md:rounded-2xl font-black text-xs md:text-xl border-b-2 md:border-b-4 border-amber-200 shadow-sm">
                  {currentIndex + 1} / {questions.length}
                </div>
                {isTimedMode && !feedback && (
                  <motion.div 
                    key={timeLeft}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    className={`px-3 py-1.5 md:px-8 md:py-3 rounded-lg md:rounded-2xl font-black text-xs md:text-2xl flex items-center gap-2 md:gap-3 border-b-2 md:border-b-4 shadow-sm ${
                      timeLeft <= 3 ? 'bg-rose-50 text-rose-500 border-rose-200 animate-pulse' : 'bg-sky-50 text-sky-500 border-sky-200'
                    }`}
                  >
                    {timeLeft}s
                  </motion.div>
                )}
              </div>
              <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 md:px-6 md:py-3 rounded-lg md:rounded-2xl font-black text-xs md:text-xl flex items-center gap-2 md:gap-3 border-b-2 md:border-b-4 border-emerald-200 shadow-sm">
                <Star className="w-4 h-4 md:w-8 md:h-8 fill-current" /> {score}
              </div>
            </div>

            <div className="flex flex-col landscape:flex-row items-center justify-center gap-4 md:gap-8 lg:gap-10 flex-1 min-h-0 overflow-hidden">
              {/* Question Area */}
              <div className="flex-1 text-center flex flex-col justify-center items-center h-full landscape:w-1/2">
                <div className="text-4xl md:text-[4rem] lg:text-[6rem] font-black text-slate-800 flex items-center justify-center gap-3 md:gap-6 mb-4 md:mb-6">
                  <span>{questions[currentIndex].a}</span>
                  <span className="text-amber-400">×</span>
                  <span>{questions[currentIndex].b}</span>
                </div>
                
                <motion.div 
                  key={currentIndex}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-28 md:w-48 lg:w-64 h-14 md:h-20 lg:h-32 text-3xl md:text-[3rem] lg:text-[5rem] flex items-center justify-center font-black rounded-xl md:rounded-3xl border-2 md:border-8 border-indigo-100 bg-indigo-50 text-indigo-600 shadow-inner"
                >
                  {userInput || '?'}
                </motion.div>
              </div>

              {/* Keypad Area */}
              <div className="flex-1 w-full max-w-lg landscape:w-1/2 h-full flex flex-col justify-center min-h-0">
                <div className="flex-1 flex flex-col justify-center min-h-0">
                  {!feedback ? (
                    <div className="grid grid-cols-3 gap-2 md:gap-3 lg:gap-4">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                        <motion.button
                          key={num}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setUserInput(prev => prev.length < 3 ? prev + num : prev)}
                          className={`
                            h-10 md:h-14 lg:h-20 text-lg md:text-2xl lg:text-4xl font-black rounded-lg md:rounded-2xl bg-white text-indigo-600 border-b-2 md:border-b-4 border-indigo-100 hover:bg-indigo-50 active:translate-y-1 active:border-b-0 transition-all shadow-sm
                            ${num === 0 ? 'col-start-2' : ''}
                          `}
                        >
                          {num}
                        </motion.button>
                      ))}
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setUserInput(prev => prev.slice(0, -1))}
                        className="h-10 md:h-14 lg:h-20 text-lg md:text-2xl lg:text-4xl font-black rounded-lg md:rounded-2xl bg-slate-50 text-slate-400 border-b-2 md:border-b-4 border-slate-100 active:translate-y-1 active:border-b-0 transition-all shadow-sm"
                      >
                        ⌫
                      </motion.button>
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className={`w-full p-4 md:p-6 lg:p-8 rounded-xl md:rounded-3xl text-center border-2 md:border-8 shadow-2xl ${
                        feedback.type === 'correct' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                      }`}
                    >
                      <div className={`text-xl md:text-3xl lg:text-5xl font-black mb-1 md:mb-4 ${
                        feedback.type === 'correct' ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {feedback.message}
                      </div>
                      {feedback.type === 'incorrect' && (
                        <div className="text-lg md:text-2xl lg:text-3xl font-black text-slate-600">
                          Respuesta: <span className="text-rose-500 text-3xl md:text-[3rem] lg:text-[5rem] leading-none">{feedback.correctAnswer}</span>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>

                <div className="mt-3 md:mt-6">
                  {!feedback ? (
                    <motion.button
                      whileHover={userInput !== '' ? { scale: 1.02 } : {}}
                      whileTap={userInput !== '' ? { scale: 0.98 } : {}}
                      onClick={() => handleAnswer()}
                      disabled={userInput === ''}
                      className={`w-full py-2 md:py-4 lg:py-6 text-white text-lg md:text-2xl lg:text-3xl font-black rounded-xl md:rounded-2xl shadow-xl border-b-4 md:border-b-8 transition-all ${
                        userInput !== '' ? 'bg-indigo-500 border-indigo-700 hover:bg-indigo-600' : 'bg-slate-100 border-slate-200 text-slate-300'
                      }`}
                    >
                      ✓ COMPROBAR
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={nextQuestion}
                      className={`w-full py-2 md:py-4 lg:py-6 text-white text-lg md:text-2xl lg:text-3xl font-black rounded-xl md:rounded-2xl shadow-xl border-b-4 md:border-b-8 transition-all flex items-center justify-center gap-2 md:gap-4 ${
                        feedback.type === 'correct' ? 'bg-emerald-500 border-emerald-700 hover:bg-emerald-600' : 'bg-rose-50 border-rose-700 hover:bg-rose-600'
                      }`}
                    >
                      SIGUIENTE ({autoAdvanceSeconds}s) <ArrowRight className="w-5 h-5 md:w-8 md:h-8" />
                    </motion.button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'results' && (
          <motion.div 
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl w-full h-full md:max-h-[92dvh] bg-white rounded-[2rem] md:rounded-[3rem] shadow-2xl p-4 md:p-6 lg:p-8 border-4 md:border-8 border-emerald-100 flex flex-col overflow-hidden landscape:max-w-7xl landscape:h-[92vh]"
          >
            <div className="text-center mb-3 md:mb-4 flex-shrink-0">
              <div className="inline-block p-2 md:p-3 bg-amber-50 rounded-[1.5rem] mb-2 shadow-inner">
                <Trophy className="w-8 h-8 md:w-12 lg:w-16 md:h-12 lg:h-16 text-amber-400" />
              </div>
              <h2 className="text-2xl md:text-3xl lg:text-5xl font-black text-slate-800 mb-1 tracking-tight">
                ¡Genial! 🌈
                <span className="ml-2 text-[10px] md:text-sm font-mono text-slate-300 vertical-middle opacity-50">v{APP_VERSION}</span>
              </h2>
              <p className="text-xs md:text-lg lg:text-xl text-slate-400 font-bold">
                {selectedTables.length === 1 
                  ? `Tabla del ${selectedTables[0]}` 
                  : `Repaso de tablas`}
              </p>
            </div>

            <div className="flex flex-col landscape:flex-row gap-4 md:gap-6 lg:gap-8 flex-1 min-h-0 overflow-y-auto landscape:overflow-hidden custom-scrollbar">
              {/* Left Side: Score & Buttons */}
              <div className="flex-1 flex flex-col gap-4 md:gap-6 landscape:w-1/2">
                <div className="bg-slate-50 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 lg:p-8 text-center border-2 border-slate-100 flex flex-col md:flex-row gap-4 md:gap-6 lg:gap-8 justify-around items-center shadow-inner flex-shrink-0">
                  <div>
                    <div className="text-[10px] md:text-xs lg:text-sm font-black text-slate-400 mb-1 uppercase tracking-widest">Puntos</div>
                    <div className="text-4xl md:text-5xl lg:text-[6rem] font-black text-indigo-500 leading-none">
                      {score}<span className="text-xs md:text-lg lg:text-xl text-slate-300">/{questions.length}</span>
                    </div>
                  </div>
                  <div className="border-t-2 md:border-t-0 md:border-l-2 border-slate-200 pt-3 md:pt-0 md:pl-6 lg:pl-8">
                    <div className="text-[10px] md:text-xs lg:text-sm font-black text-amber-500 mb-1 uppercase tracking-widest flex items-center gap-2 justify-center md:justify-start">
                      <Sparkles className="w-3 h-3 md:w-5 lg:w-6 md:h-5 lg:h-6" /> Récord
                    </div>
                    <div className="text-3xl md:text-4xl lg:text-5xl font-black text-amber-400">
                      {highScore}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 md:gap-3 mt-auto">
                  {errors.length > 0 && (
                    <button
                      onClick={startRetryErrors}
                      className="w-full py-2 md:py-3 lg:py-4 bg-orange-400 text-white text-lg md:text-xl font-black rounded-xl md:rounded-2xl shadow-xl border-b-4 md:border-b-8 bg-gradient-to-r from-orange-400 to-amber-500 border-orange-600 hover:from-orange-500 hover:to-amber-600 active:translate-y-1 active:border-b-0 transition-all flex items-center justify-center gap-2 md:gap-3"
                    >
                      <RotateCcw className="w-4 h-4 md:w-6 lg:w-8 md:h-4 lg:h-8" /> REPASAR FALLOS
                    </button>
                  )}
                  <button
                    onClick={() => setStep('setup')}
                    className="w-full py-2 md:py-3 lg:py-4 bg-indigo-400 text-white text-lg md:text-xl font-black rounded-xl md:rounded-2xl shadow-xl border-b-4 md:border-b-8 bg-gradient-to-r from-indigo-400 to-violet-500 border-indigo-600 hover:from-indigo-500 hover:to-violet-600 active:translate-y-1 active:border-b-0 transition-all flex items-center justify-center gap-2 md:gap-3"
                  >
                    <Home className="w-4 h-4 md:w-6 lg:w-8 md:h-4 lg:h-8" /> INICIO
                  </button>
                </div>
              </div>

              {/* Right Side: Error List */}
              {errors.length > 0 ? (
                <div className="flex-1 flex flex-col min-h-0 landscape:w-1/2">
                  <h3 className="text-lg md:text-xl font-black text-rose-400 mb-2 md:mb-4 flex items-center gap-2 md:gap-3 flex-shrink-0">
                    <XCircle className="w-5 h-5 md:w-6 lg:w-8" /> ¡A practicar!
                  </h3>
                  <div className="grid grid-cols-1 gap-2 flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                    {errors.map((error, idx) => (
                      <div key={idx} className="bg-rose-50 p-2 md:p-3 lg:p-4 rounded-xl md:rounded-2xl flex justify-between items-center border-2 border-rose-100 shadow-sm">
                        <span className="text-xs md:text-lg lg:text-xl font-black text-slate-600">{error.question} = ?</span>
                        <span className="text-xs md:text-lg lg:text-xl font-black text-rose-500">¡Es {error.correct}!</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-emerald-50 rounded-[2rem] p-6 landscape:w-1/2">
                  <div className="p-4 bg-white rounded-full shadow-lg mb-4">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                  </div>
                  <h3 className="text-xl md:text-3xl font-black text-emerald-600 mb-1">¡Perfecto!</h3>
                  <p className="text-emerald-500 text-sm md:text-lg font-bold">¡No has tenido fallos! ✨</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
        {step === 'learn' && (
          <motion.div 
            key="learn"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-4xl w-full h-[92dvh] bg-white rounded-3xl md:rounded-[3rem] shadow-2xl p-4 md:p-6 lg:p-10 border-4 md:border-8 border-sky-100 relative overflow-hidden flex flex-col landscape:max-w-7xl landscape:h-[92vh]"
          >
            <div className="flex justify-between items-center mb-4 md:mb-6 flex-shrink-0">
              <button 
                onClick={() => {
                  if (learningTable) setLearningTable(null);
                  else setStep('setup');
                }}
                className="p-2 md:p-4 bg-white text-slate-400 rounded-xl md:rounded-2xl hover:bg-slate-50 transition-all border-b-2 md:border-b-4 border-slate-100 active:translate-y-1 active:border-b-0 shadow-sm"
              >
                <ArrowLeft className="w-5 h-5 md:w-8 md:h-8" />
              </button>
              <h2 className="text-xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-indigo-600">
                {learningTable ? `Tabla del ${learningTable}` : 'Modo Aprendizaje'}
                <span className="ml-2 text-[10px] md:text-sm font-mono text-slate-300 vertical-middle opacity-50">v{APP_VERSION}</span>
              </h2>
              <button 
                onClick={() => setStep('setup')}
                className="p-2 md:p-4 bg-white text-slate-400 rounded-xl md:rounded-2xl hover:bg-slate-50 transition-all border-b-2 md:border-b-4 border-slate-100 active:translate-y-1 active:border-b-0 shadow-sm"
              >
                <Home className="w-5 h-5 md:w-8 md:h-8" />
              </button>
            </div>

            {!learningTable ? (
              <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto custom-scrollbar">
                <p className="text-slate-400 text-lg md:text-xl mb-4 md:mb-6 font-medium">Pulsa una tabla para estudiarla ✨</p>
                <div className="grid grid-cols-3 gap-3 md:gap-4 lg:gap-6 w-full max-w-2xl px-4 pb-8">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num, idx) => (
                    <motion.button
                      key={num}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setLearningTable(num)}
                      className={`
                        py-4 md:py-6 lg:py-8 text-3xl md:text-5xl lg:text-6xl font-black rounded-xl md:rounded-3xl transition-all border-b-4 md:border-b-8
                        ${tableColors[idx]} border-slate-200 shadow-lg shadow-slate-100
                      `}
                    >
                      {num}
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 flex-1 overflow-y-auto pr-2 md:pr-4 custom-scrollbar pb-4 md:pb-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <motion.div
                      key={num}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: num * 0.05 }}
                      className={`p-2 md:p-4 lg:p-5 rounded-xl md:rounded-2xl flex justify-between items-center border-2 border-slate-100 shadow-sm ${tableColors[learningTable - 1].split(' ')[0]} bg-opacity-30`}
                    >
                      <div className="flex items-center gap-2 md:gap-4 lg:gap-6">
                        <span className="text-lg md:text-2xl lg:text-3xl font-black text-slate-400">{learningTable}</span>
                        <span className="text-sm md:text-xl font-bold text-slate-300">×</span>
                        <span className="text-lg md:text-2xl lg:text-3xl font-black text-slate-500">{num}</span>
                      </div>
                      <div className="flex items-center gap-2 md:gap-4 lg:gap-6">
                        <span className="text-sm md:text-xl font-bold text-slate-300">=</span>
                        <span className="text-xl md:text-3xl lg:text-4xl font-black text-indigo-500">{learningTable * num}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-2 md:mt-4 pt-2 md:pt-4 border-t border-slate-50">
                  <button 
                    onClick={() => setLearningTable(null)}
                    className="w-full py-2 md:py-4 lg:py-5 bg-sky-400 text-white text-lg md:text-xl lg:text-2xl font-black rounded-xl md:rounded-3xl shadow-xl border-b-4 md:border-b-8 lg:border-b-[10px] border-sky-600 hover:bg-sky-500 active:translate-y-1 active:border-b-0 transition-all flex items-center justify-center gap-2 md:gap-3"
                  >
                    <BookOpen className="w-5 h-5 md:w-6 lg:w-8" /> ELEGIR OTRA TABLA
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}
