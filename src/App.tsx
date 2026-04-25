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
  RotateCw
} from 'lucide-react';

type Step = 'setup' | 'quiz' | 'results';
type Mode = 'order' | 'random';

const APP_VERSION = '1.0.1'; // Increment this to force a reload

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
            className="max-w-4xl w-full h-full md:max-h-[95dvh] bg-white rounded-3xl md:rounded-[3rem] shadow-2xl p-4 md:p-10 border-4 md:border-8 border-indigo-100 flex flex-col overflow-hidden landscape:max-w-7xl landscape:h-[90vh]"
          >
            <div className="flex flex-col landscape:flex-row h-full gap-4 md:gap-10">
              {/* Left Column: Title & Modes */}
              <div className="flex flex-col landscape:w-[40%] h-full">
                <div className="text-center landscape:text-left mb-4 md:mb-10 flex-shrink-0">
                  <motion.div
                    initial={{ scale: 0.8, rotate: -5 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  >
                    <h1 className="text-4xl md:text-7xl lg:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 mb-1 md:mb-2 tracking-tight drop-shadow-sm">
                      ¡Tablas Mágicas! 🪄
                    </h1>
                  </motion.div>
                  <p className="text-sm md:text-2xl text-slate-400 font-medium italic">¡Aprender es una aventura! ✨</p>
                </div>

                <div className="flex flex-col gap-4 md:gap-8 flex-1 justify-center">
                  <div className="bg-slate-50 p-4 md:p-8 rounded-2xl md:rounded-[3rem] border-2 border-slate-100 shadow-inner">
                    <h3 className="text-xs md:text-xl font-black text-slate-500 mb-4 md:mb-6 uppercase tracking-widest text-center landscape:text-left">Modo de Juego</h3>
                    <div className="flex flex-row gap-4 md:gap-6">
                      <button
                        onClick={() => setMode('order')}
                        className={`flex-1 py-3 md:py-8 px-2 rounded-xl md:rounded-[2rem] text-sm md:text-2xl font-black transition-all border-b-2 md:border-b-8 ${
                          mode === 'order' 
                            ? 'bg-emerald-400 text-white border-emerald-600 shadow-lg -translate-y-0.5' 
                            : 'bg-white text-slate-400 border-slate-100'
                        }`}
                      >
                        Orden 📏
                      </button>
                      <button
                        onClick={() => setMode('random')}
                        className={`flex-1 py-3 md:py-8 px-2 rounded-xl md:rounded-[2rem] text-sm md:text-2xl font-black transition-all border-b-2 md:border-b-8 ${
                          mode === 'random' 
                            ? 'bg-violet-400 text-white border-violet-600 shadow-lg -translate-y-0.5' 
                            : 'bg-white text-slate-400 border-slate-100'
                        }`}
                      >
                        Azar 🎲
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 md:p-8 rounded-2xl md:rounded-[3rem] border-2 border-slate-100 shadow-inner">
                    <button
                      onClick={() => setIsTimedMode(!isTimedMode)}
                      className={`w-full py-3 md:py-8 px-4 rounded-xl md:rounded-[2rem] text-sm md:text-2xl font-black transition-all border-b-2 md:border-b-8 flex items-center justify-center gap-4 md:gap-6 ${
                        isTimedMode 
                          ? 'bg-rose-400 text-white border-rose-600 shadow-lg -translate-y-0.5' 
                          : 'bg-white text-slate-400 border-slate-100'
                      }`}
                    >
                      {isTimedMode ? 'Con Tiempo ⏰' : 'Sin Tiempo ⏳'}
                    </button>
                  </div>
                </div>

                <div className="mt-auto pt-6">
                  <motion.button
                    whileHover={selectedTables.length > 0 ? { scale: 1.02 } : {}}
                    whileTap={selectedTables.length > 0 ? { scale: 0.98 } : {}}
                    disabled={selectedTables.length === 0}
                    onClick={() => selectedTables.length > 0 && startQuiz(selectedTables, mode)}
                    className={`
                      w-full py-4 md:py-10 rounded-2xl md:rounded-[4rem] text-2xl md:text-6xl font-black transition-all shadow-xl border-b-4 md:border-b-[16px]
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
              <div className="flex flex-col landscape:w-[60%] h-full">
                <div className="flex justify-between items-end mb-4 md:mb-6">
                  <h2 className="text-xl md:text-3xl font-black text-slate-700">Elige tus tablas:</h2>
                  {selectedTables.length > 0 && (
                    <button 
                      onClick={() => setSelectedTables([])}
                      className="text-xs md:text-lg font-bold text-rose-400 hover:text-rose-500 transition-colors flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4 md:w-6 md:h-6" /> Limpiar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4 md:gap-6 flex-1 min-h-0 p-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num, idx) => (
                    <motion.button
                      key={num}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleTable(num)}
                      className={`
                        h-full min-h-[60px] md:h-auto text-3xl md:text-7xl font-black rounded-2xl md:rounded-[2.5rem] transition-all border-b-4 md:border-b-[12px]
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
            className="max-w-4xl w-full h-full md:max-h-[95dvh] bg-white rounded-3xl md:rounded-[3rem] shadow-2xl p-4 md:p-10 border-4 md:border-8 border-amber-100 relative overflow-hidden flex flex-col landscape:max-w-7xl landscape:h-[90vh]"
          >
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-2 md:h-4 bg-slate-50">
              <motion.div 
                className="h-full bg-gradient-to-r from-amber-300 to-orange-400"
                initial={{ width: 0 }}
                animate={{ width: `${((currentIndex) / questions.length) * 100}%` }}
              />
            </div>

            <div className="flex justify-between items-center mb-4 md:mb-10 pt-2 md:pt-6 flex-shrink-0">
              <button 
                onClick={() => setStep('setup')}
                className="p-2 md:p-5 bg-white text-slate-400 rounded-xl md:rounded-[2rem] hover:bg-slate-50 transition-all border-b-2 md:border-b-4 border-slate-100 active:translate-y-1 active:border-b-0 shadow-sm"
                title="Volver al inicio"
              >
                <Home className="w-5 h-5 md:w-10 md:h-10" />
              </button>
              <div className="flex gap-4 md:gap-8 items-center">
                <div className="bg-amber-50 text-amber-600 px-4 py-2 md:px-8 md:py-4 rounded-xl md:rounded-[2rem] font-black text-sm md:text-3xl border-b-2 md:border-b-4 border-amber-200 shadow-sm">
                  {currentIndex + 1} / {questions.length}
                </div>
                {isTimedMode && !feedback && (
                  <motion.div 
                    key={timeLeft}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    className={`px-4 py-2 md:px-10 md:py-4 rounded-xl md:rounded-[2rem] font-black text-sm md:text-4xl flex items-center gap-2 md:gap-4 border-b-2 md:border-b-4 shadow-sm ${
                      timeLeft <= 3 ? 'bg-rose-50 text-rose-500 border-rose-200 animate-pulse' : 'bg-sky-50 text-sky-500 border-sky-200'
                    }`}
                  >
                    {timeLeft}s
                  </motion.div>
                )}
              </div>
              <div className="bg-emerald-50 text-emerald-600 px-4 py-2 md:px-8 md:py-4 rounded-xl md:rounded-[2rem] font-black text-sm md:text-3xl flex items-center gap-2 md:gap-4 border-b-2 md:border-b-4 border-emerald-200 shadow-sm">
                <Star className="w-4 h-4 md:w-10 md:h-10 fill-current" /> {score}
              </div>
            </div>

            <div className="flex flex-col landscape:flex-row items-center justify-center gap-4 md:gap-20 flex-1 min-h-0 overflow-hidden">
              {/* Question Area */}
              <div className="flex-1 text-center flex flex-col justify-center items-center h-full landscape:w-1/2">
                <div className="text-5xl md:text-[10rem] lg:text-[12rem] font-black text-slate-800 flex items-center justify-center gap-4 md:gap-16 mb-4 md:mb-16">
                  <span>{questions[currentIndex].a}</span>
                  <span className="text-amber-400">×</span>
                  <span>{questions[currentIndex].b}</span>
                </div>
                
                <motion.div 
                  key={currentIndex}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-32 md:w-[30rem] h-16 md:h-48 text-4xl md:text-[7rem] flex items-center justify-center font-black rounded-2xl md:rounded-[4rem] border-2 md:border-[12px] border-indigo-100 bg-indigo-50 text-indigo-600 shadow-inner"
                >
                  {userInput || '?'}
                </motion.div>
              </div>

              {/* Keypad Area */}
              <div className="flex-1 w-full max-w-lg landscape:w-1/2 h-full flex flex-col justify-center min-h-0">
                <div className="flex-1 flex flex-col justify-center min-h-0">
                  {!feedback ? (
                    <div className="grid grid-cols-3 gap-3 md:gap-6">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                        <motion.button
                          key={num}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setUserInput(prev => prev.length < 3 ? prev + num : prev)}
                          className={`
                            h-12 md:h-24 text-xl md:text-5xl font-black rounded-xl md:rounded-[2rem] bg-white text-indigo-600 border-b-2 md:border-b-[10px] border-indigo-100 hover:bg-indigo-50 active:translate-y-1 active:border-b-0 transition-all shadow-sm
                            ${num === 0 ? 'col-start-2' : ''}
                          `}
                        >
                          {num}
                        </motion.button>
                      ))}
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setUserInput(prev => prev.slice(0, -1))}
                        className="h-12 md:h-24 text-xl md:text-5xl font-black rounded-xl md:rounded-[2rem] bg-slate-50 text-slate-400 border-b-2 md:border-b-[10px] border-slate-100 active:translate-y-1 active:border-b-0 transition-all shadow-sm"
                      >
                        ⌫
                      </motion.button>
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className={`w-full p-6 md:p-12 rounded-2xl md:rounded-[4rem] text-center border-2 md:border-[12px] shadow-2xl ${
                        feedback.type === 'correct' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                      }`}
                    >
                      <div className={`text-2xl md:text-7xl font-black mb-2 md:mb-6 ${
                        feedback.type === 'correct' ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {feedback.message}
                      </div>
                      {feedback.type === 'incorrect' && (
                        <div className="text-lg md:text-5xl font-black text-slate-600">
                          Respuesta: <span className="text-rose-500 text-3xl md:text-[8rem] leading-none">{feedback.correctAnswer}</span>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>

                <div className="mt-6 md:mt-16">
                  {!feedback ? (
                    <motion.button
                      whileHover={userInput !== '' ? { scale: 1.02 } : {}}
                      whileTap={userInput !== '' ? { scale: 0.98 } : {}}
                      onClick={() => handleAnswer()}
                      disabled={userInput === ''}
                      className={`w-full py-4 md:py-10 text-white text-xl md:text-5xl font-black rounded-2xl md:rounded-[3rem] shadow-xl border-b-4 md:border-b-[16px] transition-all ${
                        userInput !== '' ? 'bg-indigo-500 border-indigo-700 hover:bg-indigo-600' : 'bg-slate-100 border-slate-200 text-slate-300'
                      }`}
                    >
                      ¡LISTO! ✅
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={nextQuestion}
                      className={`w-full py-4 md:py-10 text-white text-xl md:text-5xl font-black rounded-2xl md:rounded-[3rem] shadow-xl border-b-4 md:border-b-[16px] transition-all flex items-center justify-center gap-4 md:gap-8 ${
                        feedback.type === 'correct' ? 'bg-emerald-500 border-emerald-700 hover:bg-emerald-600' : 'bg-rose-500 border-rose-700 hover:bg-rose-600'
                      }`}
                    >
                      SIGUIENTE ({autoAdvanceSeconds}s) <ArrowRight className="w-6 h-6 md:w-16 md:h-16" />
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
            className="max-w-4xl w-full max-h-full bg-white rounded-[2.5rem] shadow-2xl p-4 md:p-12 border-4 md:border-8 border-emerald-100 flex flex-col overflow-hidden landscape:max-w-7xl landscape:h-[90vh]"
          >
            <div className="text-center mb-4 md:mb-10 flex-shrink-0">
              <div className="inline-block p-2 md:p-6 bg-amber-50 rounded-[2rem] mb-2 md:mb-6 shadow-inner">
                <Trophy className="w-10 h-10 md:w-24 md:h-24 text-amber-400" />
              </div>
              <h2 className="text-3xl md:text-7xl font-black text-slate-800 mb-1 md:mb-4 tracking-tight">¡Genial! 🌈</h2>
              <p className="text-sm md:text-3xl text-slate-400 font-bold">
                {selectedTables.length === 1 
                  ? `Tabla del ${selectedTables[0]}` 
                  : `Repaso de tablas`}
              </p>
            </div>

            <div className="flex flex-col landscape:flex-row gap-6 md:gap-12 flex-1 min-h-0 overflow-y-auto landscape:overflow-hidden custom-scrollbar">
              {/* Left Side: Score & Buttons */}
              <div className="flex-1 flex flex-col gap-6 md:gap-10 landscape:w-1/2">
                <div className="bg-slate-50 rounded-[2.5rem] p-6 md:p-12 text-center border-2 border-slate-100 flex flex-col md:flex-row gap-6 md:gap-10 justify-around items-center shadow-inner flex-shrink-0">
                  <div>
                    <div className="text-xs md:text-xl font-black text-slate-400 mb-2 uppercase tracking-widest">Puntos</div>
                    <div className="text-5xl md:text-[8rem] font-black text-indigo-500 leading-none">
                      {score}<span className="text-lg md:text-3xl text-slate-300">/{questions.length}</span>
                    </div>
                  </div>
                  <div className="border-t-2 md:border-t-0 md:border-l-2 border-slate-200 pt-4 md:pt-0 md:pl-10">
                    <div className="text-xs md:text-xl font-black text-amber-500 mb-2 uppercase tracking-widest flex items-center gap-2 justify-center md:justify-start">
                      <Sparkles className="w-4 h-4 md:w-8 md:h-8" /> Récord
                    </div>
                    <div className="text-4xl md:text-7xl font-black text-amber-400">
                      {highScore}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 md:gap-6 mt-auto">
                  {errors.length > 0 && (
                    <button
                      onClick={startRetryErrors}
                      className="w-full py-4 md:py-8 bg-orange-400 text-white text-xl md:text-3xl font-black rounded-[2.5rem] shadow-xl border-b-4 md:border-b-[12px] border-orange-600 hover:bg-orange-500 active:translate-y-1 active:border-b-0 transition-all flex items-center justify-center gap-3 md:gap-4"
                    >
                      <RotateCcw className="w-6 h-6 md:w-10 md:h-10" /> REPASAR FALLOS
                    </button>
                  )}
                  <button
                    onClick={() => setStep('setup')}
                    className="w-full py-4 md:py-8 bg-indigo-400 text-white text-xl md:text-3xl font-black rounded-[2.5rem] shadow-xl border-b-4 md:border-b-[12px] border-indigo-600 hover:bg-indigo-500 active:translate-y-1 active:border-b-0 transition-all flex items-center justify-center gap-3 md:gap-4"
                  >
                    <Home className="w-6 h-6 md:w-10 md:h-10" /> INICIO
                  </button>
                </div>
              </div>

              {/* Right Side: Error List */}
              {errors.length > 0 && (
                <div className="flex-1 flex flex-col min-h-0 landscape:w-1/2">
                  <h3 className="text-xl md:text-4xl font-black text-rose-400 mb-4 md:mb-8 flex items-center gap-3 md:gap-4 flex-shrink-0">
                    <XCircle className="w-6 h-6 md:w-12 md:h-12" /> ¡A practicar!
                  </h3>
                  <div className="grid grid-cols-1 gap-3 md:gap-4 flex-1 min-h-0 overflow-y-auto pr-4 custom-scrollbar">
                    {errors.map((error, idx) => (
                      <div key={idx} className="bg-rose-50 p-4 md:p-8 rounded-[2rem] flex justify-between items-center border-2 border-rose-100 shadow-sm">
                        <span className="text-lg md:text-3xl font-black text-slate-600">{error.question} = ?</span>
                        <span className="text-lg md:text-3xl font-black text-rose-500">¡Es {error.correct}!</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
