/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
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
  BookOpen, 
  ArrowLeft,
  Clock,
  Infinity as InfinityIcon,
  Shuffle,
  ListOrdered,
  Undo2,
  Check,
  Zap
} from 'lucide-react';
import { useDeviceOrientation } from './utils/useDeviceOrientation';
import { OrientationLockOverlay } from './components/OrientationLockOverlay';

type Step = 'setup' | 'quiz' | 'results' | 'learn';
type Mode = 'order' | 'reverse' | 'random';

const APP_VERSION = '1.0.8';

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

const AVAILABLE_TABLES = [2, 3, 4, 5, 6, 7, 8, 9];

const TABLE_THEMES: Record<number, { bg: string; text: string; border: string; activeBg: string; activeBorder: string }> = {
  2: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', activeBg: 'bg-amber-500 text-white', activeBorder: 'border-amber-700' },
  3: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', activeBg: 'bg-orange-500 text-white', activeBorder: 'border-orange-700' },
  4: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', activeBg: 'bg-rose-500 text-white', activeBorder: 'border-rose-700' },
  5: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', activeBg: 'bg-emerald-500 text-white', activeBorder: 'border-emerald-700' },
  6: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', activeBg: 'bg-teal-500 text-white', activeBorder: 'border-teal-700' },
  7: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', activeBg: 'bg-sky-500 text-white', activeBorder: 'border-sky-700' },
  8: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', activeBg: 'bg-indigo-600 text-white', activeBorder: 'border-indigo-800' },
  9: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', activeBg: 'bg-purple-600 text-white', activeBorder: 'border-purple-800' },
};

export default function App() {
  const [step, setStep] = useState<Step>('setup');
  const [learningTable, setLearningTable] = useState<number | null>(null);

  // PWA update handler
  useRegisterSW({
    onRegistered(r) {
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onNeedRefresh() {
      if (window.confirm('¡Hay una nueva versión disponible! ¿Quieres actualizar ahora?')) {
        window.location.reload();
      }
    },
  });

  // Device orientation lock & responsive detection
  const { deviceType, isOrientationValid, expectedOrientation } = useDeviceOrientation();

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

  // Settings state
  const [selectedTables, setSelectedTables] = useState<number[]>([2]);
  const [mode, setMode] = useState<Mode>('order');
  const [isTimedMode, setIsTimedMode] = useState<boolean>(false);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number>(10);

  // Quiz state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [score, setScore] = useState(0);
  const [errors, setErrors] = useState<ErrorRecord[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'incorrect'; message: string; correctAnswer?: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const [autoAdvanceSeconds, setAutoAdvanceSeconds] = useState(2);
  const [isRetryingErrors, setIsRetryingErrors] = useState(false);

  const [highScore, setHighScore] = useState<number>(() => {
    const saved = localStorage.getItem('tablasMagicasHighScore');
    return saved ? parseInt(saved) : 0;
  });

  // Table selection toggling
  const toggleTable = (num: number) => {
    setSelectedTables(prev => 
      prev.includes(num)
        ? prev.filter(t => t !== num)
        : [...prev, num].sort((a, b) => a - b)
    );
  };

  const selectAllTables = () => setSelectedTables([...AVAILABLE_TABLES]);
  const clearTables = () => setSelectedTables([]);

  // Quiz generation
  const startQuiz = (tables: number[], quizMode: Mode) => {
    if (tables.length === 0) return;

    let qList: Question[] = [];
    tables.forEach(table => {
      if (quizMode === 'reverse') {
        // En orden inverso: 10 al 1
        for (let i = 10; i >= 1; i--) {
          qList.push({ a: table, b: i, correct: table * i });
        }
      } else {
        // En orden (1 al 10) o aleatorio (se mezclará después)
        for (let i = 1; i <= 10; i++) {
          qList.push({ a: table, b: i, correct: table * i });
        }
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
    setTimeLeft(timeLimitSeconds);
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
    setTimeLeft(timeLimitSeconds);
  };

  const handleTimeOut = useCallback(() => {
    if (questions.length === 0 || currentIndex >= questions.length) return;
    const currentQ = questions[currentIndex];
    const record: ErrorRecord = {
      question: `${currentQ.a} × ${currentQ.b}`,
      correct: currentQ.correct,
      user: -1
    };
    setErrors(prev => [...prev, record]);
    setFeedback({ 
      type: 'incorrect', 
      message: '¡Tiempo agotado! ⏰',
      correctAnswer: currentQ.correct
    });
  }, [questions, currentIndex]);

  // Timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'quiz' && isTimedMode && !feedback && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (step === 'quiz' && isTimedMode && timeLeft === 0 && !feedback) {
      handleTimeOut();
    }
    return () => clearInterval(timer);
  }, [step, isTimedMode, feedback, timeLeft, handleTimeOut]);

  // Answer handler
  const handleAnswer = useCallback((val?: string) => {
    const inputToTest = val !== undefined ? val : userInput;
    if (inputToTest.trim() === '' || feedback !== null) return;

    const currentQ = questions[currentIndex];
    const userAns = parseInt(inputToTest, 10);
    const isCorrect = userAns === currentQ.correct;

    if (isCorrect) {
      setScore(prev => prev + 1);
      setFeedback({ type: 'correct', message: '¡Excelente! 🌟' });
    } else {
      const record: ErrorRecord = {
        question: `${currentQ.a} × ${currentQ.b}`,
        correct: currentQ.correct,
        user: isNaN(userAns) ? -1 : userAns
      };
      setErrors(prev => [...prev, record]);
      setFeedback({ 
        type: 'incorrect', 
        message: '¡Casi! Repásala.',
        correctAnswer: currentQ.correct
      });
    }
  }, [userInput, feedback, questions, currentIndex]);

  const nextQuestion = useCallback(() => {
    setFeedback(null);
    setUserInput('');
    setTimeLeft(timeLimitSeconds);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      const finalScore = score + (feedback?.type === 'correct' ? 1 : 0);
      if (finalScore > highScore) {
        setHighScore(finalScore);
        localStorage.setItem('tablasMagicasHighScore', finalScore.toString());
      }
      setStep('results');
    }
  }, [currentIndex, questions.length, score, feedback, highScore, timeLimitSeconds]);

  // Auto-advance on feedback
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
  }, [feedback, step, nextQuestion]);

  // Hardware keyboard listener
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (step !== 'quiz') return;

      if (e.key >= '0' && e.key <= '9') {
        if (!feedback) {
          setUserInput(prev => (prev.length < 3 ? prev + e.key : prev));
        }
      } else if (e.key === 'Backspace') {
        if (!feedback) {
          setUserInput(prev => prev.slice(0, -1));
        }
      } else if (e.key === 'Enter') {
        if (feedback) {
          nextQuestion();
        } else {
          handleAnswer();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step, feedback, handleAnswer, nextQuestion]);

  return (
    <>
      {!isOrientationValid && (
        <OrientationLockOverlay
          deviceType={deviceType}
          expectedOrientation={expectedOrientation}
        />
      )}
      <div className="h-[100dvh] w-full max-h-[100dvh] bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 font-sans text-slate-800 p-1 sm:p-2 md:p-3 lg:p-4 xl:p-5 flex flex-col items-center justify-center overflow-hidden select-none">
        <div className="w-full h-full max-h-full flex flex-col items-center justify-center max-w-[1920px]">
          <AnimatePresence mode="wait">

            {/* SCREEN 1: SETUP */}
            {step === 'setup' && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="w-full h-full max-h-full bg-white rounded-2xl sm:rounded-3xl md:rounded-[2.25rem] shadow-xl md:shadow-2xl p-3 sm:p-4 md:p-5 lg:p-6 border-2 sm:border-4 md:border-8 border-indigo-100 flex flex-col justify-between gap-2 sm:gap-3 overflow-hidden"
              >
                {/* Top Bar / Header */}
                <div className="flex items-center justify-between gap-2 pb-2 sm:pb-2.5 border-b border-slate-100 flex-shrink-0">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <span className="text-2xl sm:text-3xl md:text-4xl">🪄</span>
                    <div>
                      <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 leading-tight">
                        ¡Tablas Mágicas!
                      </h1>
                      <p className="text-[11px] sm:text-xs md:text-sm text-slate-400 font-medium hidden sm:block">
                        Practica tus tablas de multiplicar sin conexión ✨
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3">
                    {highScore > 0 && (
                      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 text-xs md:text-sm font-black">
                        <Star className="w-4 h-4 fill-current text-amber-500" />
                        <span>Récord: {highScore}</span>
                      </div>
                    )}
                    <button
                      onClick={() => setStep('learn')}
                      className="py-1.5 sm:py-2 px-3 sm:px-4 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
                      title="Ver tablas de multiplicar"
                    >
                      <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-sky-600" />
                      <span>Modo Estudio</span>
                    </button>
                    <span className="text-[10px] sm:text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 font-bold">
                      v{APP_VERSION}
                    </span>
                  </div>
                </div>

                {/* Main Content Area: Responsive side-by-side on landscape (tablet), stacked on portrait */}
                <div className="flex-1 min-h-0 py-1 flex flex-col landscape:flex-row gap-2.5 sm:gap-3.5 md:gap-4 lg:gap-5 overflow-hidden">
                  
                  {/* Left Panel: 1. Tables Selection (Del 2 al 9) */}
                  <div className="flex flex-col bg-slate-50/90 p-2.5 sm:p-3.5 md:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs flex-shrink-0 landscape:w-[57%] landscape:h-full justify-between">
                    <div className="flex items-center justify-between mb-1.5 sm:mb-2 md:mb-2.5 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm md:text-base font-black text-slate-700 uppercase tracking-wider">
                          1. Elige las tablas (2 al 9)
                        </span>
                        {selectedTables.length > 0 && (
                          <span className="bg-indigo-100 text-indigo-700 font-black text-[10px] sm:text-xs md:text-sm px-2.5 py-0.5 rounded-full">
                            {selectedTables.length} {selectedTables.length === 1 ? 'tabla' : 'tablas'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <button
                          onClick={selectAllTables}
                          className="text-[11px] sm:text-xs md:text-sm font-bold text-indigo-600 hover:text-indigo-800 bg-white px-2.5 py-1 rounded-lg border border-indigo-100 shadow-2xs hover:bg-indigo-50 transition-colors active:scale-95"
                        >
                          Todas
                        </button>
                        <button
                          onClick={clearTables}
                          className="text-[11px] sm:text-xs md:text-sm font-bold text-rose-500 hover:text-rose-700 bg-white px-2.5 py-1 rounded-lg border border-rose-100 shadow-2xs hover:bg-rose-50 transition-colors active:scale-95"
                        >
                          Limpiar
                        </button>
                      </div>
                    </div>

                    {/* 8 Table Buttons: 4 cols x 2 rows, filling vertical height in landscape */}
                    <div className="grid grid-cols-4 gap-2 sm:gap-2.5 md:gap-3 landscape:flex-1 landscape:min-h-0 landscape:grid-rows-2">
                      {AVAILABLE_TABLES.map((num) => {
                        const isSelected = selectedTables.includes(num);
                        const theme = TABLE_THEMES[num];
                        return (
                          <motion.button
                            key={num}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => toggleTable(num)}
                            className={`
                              relative flex flex-col items-center justify-center rounded-xl sm:rounded-2xl font-black transition-all border-b-3 sm:border-b-4
                              h-16 sm:h-20 md:h-22 landscape:h-full landscape:min-h-0
                              ${isSelected 
                                ? `${theme.activeBg} ${theme.activeBorder} shadow-md -translate-y-0.5` 
                                : `${theme.bg} ${theme.text} ${theme.border} hover:brightness-95`
                              }
                            `}
                          >
                            <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl leading-none">
                              {num}
                            </span>
                            <span className={`text-[10px] sm:text-xs md:text-sm font-bold mt-0.5 sm:mt-1 opacity-90 ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                              Tabla del {num}
                            </span>
                            {isSelected && (
                              <span className="absolute top-1 right-1 sm:top-2 sm:right-2 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 bg-white text-emerald-600 rounded-full flex items-center justify-center shadow-xs">
                                <Check className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 stroke-[3]" />
                              </span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Panel: Modes (2), Timer (3) and Launch CTA (4) */}
                  <div className="flex flex-col gap-2.5 sm:gap-3 md:gap-3.5 landscape:w-[43%] landscape:h-full landscape:justify-between flex-shrink-0">
                    
                    {/* Modes & Timer: 2 cols on tablet portrait, 1 col stacked on landscape */}
                    <div className="grid grid-cols-1 md:grid-cols-2 landscape:grid-cols-1 gap-2.5 sm:gap-3 landscape:flex-1 landscape:min-h-0">
                      
                      {/* 2. Mode of play */}
                      <div className="bg-slate-50/90 p-2.5 sm:p-3 md:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between gap-1.5 sm:gap-2">
                        <span className="text-xs sm:text-sm md:text-base font-black text-slate-700 uppercase tracking-wider">
                          2. Modo de Juego
                        </span>
                        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 flex-1 items-stretch">
                          <button
                            onClick={() => setMode('order')}
                            className={`py-2 sm:py-2.5 md:py-3 px-1 rounded-xl text-center font-black transition-all border-b-2 sm:border-b-3 flex flex-col items-center justify-center gap-0.5 sm:gap-1 ${
                              mode === 'order'
                                ? 'bg-emerald-500 text-white border-emerald-700 shadow-md -translate-y-0.5'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <ListOrdered className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                            <span className="text-[11px] sm:text-xs md:text-sm font-black leading-tight">En orden</span>
                            <span className="text-[9px] sm:text-[10px] md:text-xs opacity-80">1 al 10</span>
                          </button>

                          <button
                            onClick={() => setMode('reverse')}
                            className={`py-2 sm:py-2.5 md:py-3 px-1 rounded-xl text-center font-black transition-all border-b-2 sm:border-b-3 flex flex-col items-center justify-center gap-0.5 sm:gap-1 ${
                              mode === 'reverse'
                                ? 'bg-amber-500 text-white border-amber-700 shadow-md -translate-y-0.5'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <Undo2 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                            <span className="text-[11px] sm:text-xs md:text-sm font-black leading-tight">Inverso</span>
                            <span className="text-[9px] sm:text-[10px] md:text-xs opacity-80">10 al 1</span>
                          </button>

                          <button
                            onClick={() => setMode('random')}
                            className={`py-2 sm:py-2.5 md:py-3 px-1 rounded-xl text-center font-black transition-all border-b-2 sm:border-b-3 flex flex-col items-center justify-center gap-0.5 sm:gap-1 ${
                              mode === 'random'
                                ? 'bg-violet-500 text-white border-violet-700 shadow-md -translate-y-0.5'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <Shuffle className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                            <span className="text-[11px] sm:text-xs md:text-sm font-black leading-tight">Aleatorio</span>
                            <span className="text-[9px] sm:text-[10px] md:text-xs opacity-80">Mezclado</span>
                          </button>
                        </div>
                      </div>

                      {/* 3. Time Option */}
                      <div className="bg-slate-50/90 p-2.5 sm:p-3 md:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between gap-1.5 sm:gap-2">
                        <span className="text-xs sm:text-sm md:text-base font-black text-slate-700 uppercase tracking-wider">
                          3. Tiempo Límite
                        </span>
                        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 flex-1 items-stretch">
                          <button
                            onClick={() => setIsTimedMode(false)}
                            className={`py-2.5 sm:py-3 px-2 rounded-xl text-center font-black transition-all border-b-2 sm:border-b-3 flex items-center justify-center gap-1.5 sm:gap-2 ${
                              !isTimedMode
                                ? 'bg-sky-500 text-white border-sky-700 shadow-md -translate-y-0.5'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <InfinityIcon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                            <span className="text-xs sm:text-sm md:text-base font-bold">Sin tiempo</span>
                          </button>

                          <button
                            onClick={() => setIsTimedMode(true)}
                            className={`py-2.5 sm:py-3 px-2 rounded-xl text-center font-black transition-all border-b-2 sm:border-b-3 flex items-center justify-center gap-1.5 sm:gap-2 ${
                              isTimedMode
                                ? 'bg-rose-500 text-white border-rose-700 shadow-md -translate-y-0.5'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <Clock className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                            <span className="text-xs sm:text-sm md:text-base font-bold">Con tiempo ({timeLimitSeconds}s)</span>
                          </button>
                        </div>
                      </div>

                    </div>

                    {/* 4. Launch button */}
                    <div className="flex-shrink-0">
                      <motion.button
                        whileHover={selectedTables.length > 0 ? { scale: 1.01 } : {}}
                        whileTap={selectedTables.length > 0 ? { scale: 0.98 } : {}}
                        onClick={() => selectedTables.length > 0 && startQuiz(selectedTables, mode)}
                        disabled={selectedTables.length === 0}
                        className={`
                          w-full py-3.5 sm:py-4 md:py-4.5 lg:py-5 rounded-xl sm:rounded-2xl md:rounded-3xl text-base sm:text-xl md:text-2xl font-black transition-all shadow-lg border-b-3 sm:border-b-4 md:border-b-5 flex items-center justify-center gap-2 sm:gap-3
                          ${selectedTables.length > 0
                            ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white border-emerald-700 hover:brightness-105 active:translate-y-1'
                            : 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed'
                          }
                        `}
                      >
                        <Zap className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 fill-current" />
                        <span>
                          {selectedTables.length > 0 
                            ? `¡A JUGAR! (${selectedTables.length * 10} preguntas)` 
                            : 'Elige al menos 1 tabla'
                          }
                        </span>
                      </motion.button>
                    </div>

                  </div>

                </div>
              </motion.div>
            )}

            {/* SCREEN 2: QUIZ */}
            {step === 'quiz' && questions.length > 0 && (
              <motion.div
                key="quiz"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="w-full h-full max-h-full bg-white rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] shadow-xl md:shadow-2xl p-3 sm:p-5 md:p-6 lg:p-8 border-2 sm:border-4 md:border-8 border-indigo-100 relative overflow-hidden flex flex-col justify-between"
              >
                {/* Progress bar at top */}
                <div className="absolute top-0 left-0 w-full h-1.5 sm:h-2 md:h-2.5 bg-slate-100">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                {/* Top Navigation Bar */}
                <div className="flex justify-between items-center pt-1 pb-1.5 sm:pb-3 border-b border-slate-100 flex-shrink-0">
                  <button
                    onClick={() => setStep('setup')}
                    className="p-1.5 sm:p-2 md:p-3 bg-slate-50 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl md:rounded-2xl border border-slate-200 transition-all shadow-xs active:scale-95"
                    title="Volver al inicio"
                  >
                    <Home className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                  </button>

                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="bg-indigo-50 text-indigo-700 px-2.5 py-1 sm:px-3.5 sm:py-1.5 md:px-4 md:py-2 rounded-xl md:rounded-2xl font-black text-xs sm:text-sm md:text-base border border-indigo-200">
                      Pregunta {currentIndex + 1} / {questions.length}
                    </div>
                    
                    {isTimedMode && (
                      <motion.div
                        key={timeLeft}
                        initial={{ scale: 1.15 }}
                        animate={{ scale: 1 }}
                        className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 md:px-4 md:py-2 rounded-xl md:rounded-2xl font-black text-xs sm:text-sm md:text-base flex items-center gap-1.5 border ${
                          timeLeft <= 3 
                            ? 'bg-rose-100 text-rose-600 border-rose-300 animate-pulse' 
                            : 'bg-amber-50 text-amber-600 border-amber-200'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                        <span>{timeLeft}s</span>
                      </motion.div>
                    )}
                  </div>

                  <div className="bg-emerald-50 text-emerald-700 px-2.5 py-1 sm:px-3.5 sm:py-1.5 md:px-4 md:py-2 rounded-xl md:rounded-2xl font-black text-xs sm:text-sm md:text-base flex items-center gap-1.5 border border-emerald-200">
                    <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 fill-current text-emerald-500" />
                    <span>{score}</span>
                  </div>
                </div>

                {/* Main Quiz Area: Side-by-side on landscape (tablet / computer) */}
                <div className="flex-1 min-h-0 py-2 sm:py-3 md:py-4 flex flex-col landscape:flex-row items-center justify-between gap-3 sm:gap-6 md:gap-8 lg:gap-12 overflow-hidden">
                  
                  {/* Question Display & Result Preview */}
                  <div className="flex-1 min-h-0 w-full landscape:w-[54%] flex flex-col items-center justify-center text-center landscape:h-full landscape:justify-around">
                    <div className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-black text-slate-800 flex items-center justify-center gap-2 sm:gap-4 md:gap-6 mb-2 sm:mb-4">
                      <span>{questions[currentIndex].a}</span>
                      <span className="text-indigo-500">×</span>
                      <span>{questions[currentIndex].b}</span>
                      <span className="text-slate-400">=</span>
                    </div>

                    {/* Input display box */}
                    <motion.div
                      key={currentIndex}
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`
                        w-28 sm:w-36 md:w-52 lg:w-64 h-14 sm:h-16 md:h-22 lg:h-26 text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black rounded-xl sm:rounded-2xl md:rounded-3xl border-2 sm:border-4 md:border-6 flex items-center justify-center shadow-inner transition-colors
                        ${feedback 
                          ? feedback.type === 'correct' 
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300' 
                            : 'bg-rose-100 text-rose-700 border-rose-300'
                          : userInput 
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-300' 
                            : 'bg-slate-50 text-slate-300 border-slate-200'
                        }
                      `}
                    >
                      {feedback 
                        ? feedback.type === 'correct' 
                          ? userInput 
                          : feedback.correctAnswer 
                        : (userInput || '?')
                      }
                    </motion.div>

                    {/* Instant Feedback indicator */}
                    <div className="h-6 sm:h-8 md:h-10 mt-2 flex items-center justify-center">
                      {feedback && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`text-xs sm:text-base md:text-lg lg:text-xl font-black px-4 py-1 rounded-full ${
                            feedback.type === 'correct' 
                              ? 'bg-emerald-500 text-white' 
                              : 'bg-rose-500 text-white'
                          }`}
                        >
                          {feedback.message} {feedback.type === 'incorrect' && `(${questions[currentIndex].a} × ${questions[currentIndex].b} = ${feedback.correctAnswer})`}
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Keypad & Action */}
                  <div className="w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg landscape:w-[46%] flex flex-col justify-center min-h-0 flex-shrink-0 landscape:h-full gap-2 md:gap-3">
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-3">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <motion.button
                          key={num}
                          whileTap={{ scale: 0.92 }}
                          onClick={() => !feedback && setUserInput(prev => prev.length < 3 ? prev + num : prev)}
                          disabled={feedback !== null}
                          className="h-11 sm:h-13 md:h-16 lg:h-18 xl:h-20 text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black rounded-xl sm:rounded-2xl bg-white text-indigo-700 border-b-2 sm:border-b-4 border-indigo-100 hover:bg-indigo-50 shadow-xs active:translate-y-0.5 active:border-b-0 transition-all"
                        >
                          {num}
                        </motion.button>
                      ))}

                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={() => !feedback && setUserInput(prev => prev.slice(0, -1))}
                        disabled={feedback !== null}
                        className="h-11 sm:h-13 md:h-16 lg:h-18 xl:h-20 text-base sm:text-xl md:text-2xl lg:text-3xl font-black rounded-xl sm:rounded-2xl bg-rose-50 text-rose-600 border-b-2 sm:border-b-4 border-rose-100 hover:bg-rose-100 shadow-xs active:translate-y-0.5 active:border-b-0 transition-all flex items-center justify-center"
                        title="Borrar"
                      >
                        ⌫
                      </motion.button>

                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={() => !feedback && setUserInput(prev => prev.length < 3 ? prev + '0' : prev)}
                        disabled={feedback !== null}
                        className="h-11 sm:h-13 md:h-16 lg:h-18 xl:h-20 text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black rounded-xl sm:rounded-2xl bg-white text-indigo-700 border-b-2 sm:border-b-4 border-indigo-100 hover:bg-indigo-50 shadow-xs active:translate-y-0.5 active:border-b-0 transition-all"
                      >
                        0
                      </motion.button>

                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={() => !feedback && setUserInput('')}
                        disabled={feedback !== null || userInput === ''}
                        className="h-11 sm:h-13 md:h-16 lg:h-18 xl:h-20 text-sm sm:text-base md:text-lg font-bold rounded-xl sm:rounded-2xl bg-slate-100 text-slate-500 border-b-2 sm:border-b-4 border-slate-200 hover:bg-slate-200 shadow-xs active:translate-y-0.5 active:border-b-0 transition-all disabled:opacity-50"
                        title="Limpiar"
                      >
                        C
                      </motion.button>
                    </div>

                    {/* Submit / Next Button */}
                    <div className="mt-1 sm:mt-2">
                      {!feedback ? (
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleAnswer()}
                          disabled={userInput === ''}
                          className={`
                            w-full py-2.5 sm:py-3.5 md:py-4 lg:py-5 rounded-xl sm:rounded-2xl font-black text-sm sm:text-lg md:text-xl lg:text-2xl shadow-md border-b-2 sm:border-b-4 md:border-b-5 transition-all flex items-center justify-center gap-2
                            ${userInput !== '' 
                              ? 'bg-indigo-600 text-white border-indigo-800 hover:bg-indigo-700 active:translate-y-0.5 active:border-b-0' 
                              : 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed'
                            }
                          `}
                        >
                          <span>COMPROBAR</span>
                          <Check className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                        </motion.button>
                      ) : (
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={nextQuestion}
                          className={`
                            w-full py-2.5 sm:py-3.5 md:py-4 lg:py-5 rounded-xl sm:rounded-2xl font-black text-sm sm:text-lg md:text-xl lg:text-2xl text-white shadow-md border-b-2 sm:border-b-4 md:border-b-5 transition-all flex items-center justify-center gap-2
                            ${feedback.type === 'correct' 
                              ? 'bg-emerald-500 border-emerald-700 hover:bg-emerald-600 active:translate-y-0.5' 
                              : 'bg-rose-500 border-rose-700 hover:bg-rose-600 active:translate-y-0.5'
                            }
                          `}
                        >
                          <span>SIGUIENTE ({autoAdvanceSeconds}s)</span>
                          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                        </motion.button>
                      )}
                    </div>
                  </div>

                </div>
              </motion.div>
            )}

          {/* SCREEN 3: RESULTS */}
          {step === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full h-full max-h-full bg-white rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] shadow-xl md:shadow-2xl p-3 sm:p-5 md:p-6 lg:p-8 border-2 sm:border-4 md:border-8 border-emerald-100 flex flex-col justify-between overflow-hidden"
            >
              {/* Header */}
              <div className="text-center pb-2 flex-shrink-0">
                <div className="inline-flex p-2.5 sm:p-3 bg-amber-50 rounded-2xl border border-amber-200 mb-1.5">
                  <Trophy className="w-7 h-7 sm:w-10 sm:h-10 md:w-12 md:h-12 text-amber-500" />
                </div>
                <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-slate-800 leading-tight">
                  {errors.length === 0 ? '¡Puntuación Perfecta! 🌟' : '¡Excelente Trabajo! 👏'}
                </h2>
                <p className="text-xs sm:text-sm md:text-base text-slate-500 font-medium">
                  {selectedTables.length === 1 
                    ? `Tabla del ${selectedTables[0]}` 
                    : `${selectedTables.length} tablas practicadas (${selectedTables.join(', ')})`
                  }
                </p>
              </div>

              {/* Main Body */}
              <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3 sm:gap-6 items-stretch justify-center overflow-hidden py-1">
                
                {/* Score Summary Box */}
                <div className="flex-1 flex flex-col justify-around bg-slate-50 p-3 sm:p-5 md:p-6 rounded-2xl border border-slate-200 shadow-inner text-center">
                  <div className="flex justify-around items-center">
                    <div>
                      <div className="text-[10px] sm:text-xs md:text-sm font-black text-slate-400 uppercase tracking-wider">Aciertos</div>
                      <div className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-indigo-600 leading-none mt-1">
                        {score}<span className="text-base sm:text-2xl md:text-3xl text-slate-400">/{questions.length}</span>
                      </div>
                    </div>

                    <div className="h-12 w-px bg-slate-200" />

                    <div>
                      <div className="text-[10px] sm:text-xs md:text-sm font-black text-amber-500 uppercase tracking-wider flex items-center justify-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>Récord</span>
                      </div>
                      <div className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-amber-500 leading-none mt-1">
                        {highScore}
                      </div>
                    </div>
                  </div>

                  {errors.length === 0 && (
                    <div className="mt-2 bg-emerald-100 text-emerald-800 text-xs sm:text-sm md:text-base font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                      <span>¡Sin ningún error! Eres un genio de las matemáticas.</span>
                    </div>
                  )}
                </div>

                {/* Errors Review list or celebratory card */}
                {errors.length > 0 ? (
                  <div className="flex-1 min-h-0 flex flex-col bg-rose-50/70 p-3 sm:p-4 rounded-2xl border border-rose-200">
                    <div className="text-xs sm:text-sm md:text-base font-black text-rose-700 uppercase tracking-wider flex items-center gap-2 mb-2 flex-shrink-0">
                      <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500" />
                      <span>Para repasar ({errors.length}):</span>
                    </div>
                    
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
                      {errors.map((err, idx) => (
                        <div key={idx} className="bg-white p-2 rounded-xl flex justify-between items-center text-xs sm:text-sm md:text-base font-bold border border-rose-100 shadow-2xs">
                          <span className="text-slate-700">{err.question}</span>
                          <span className="text-rose-600 font-black">Es {err.correct}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center bg-emerald-50/60 p-4 sm:p-6 rounded-2xl border border-emerald-200 text-center">
                    <span className="text-4xl sm:text-6xl mb-2">🎉</span>
                    <h3 className="text-lg sm:text-2xl font-black text-emerald-700">¡Reto Superado!</h3>
                    <p className="text-xs sm:text-sm md:text-base text-emerald-600">Sigue así y dominarás todas las tablas.</p>
                  </div>
                )}

              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2 sm:gap-4 flex-shrink-0">
                {errors.length > 0 && (
                  <button
                    onClick={startRetryErrors}
                    className="flex-1 py-3 sm:py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-base md:text-lg shadow-md border-b-3 sm:border-b-4 border-amber-700 hover:brightness-105 active:translate-y-0.5 flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>REPASAR FALLOS</span>
                  </button>
                )}

                <button
                  onClick={() => setStep('setup')}
                  className="flex-1 py-3 sm:py-4 bg-indigo-600 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-base md:text-lg shadow-md border-b-3 sm:border-b-4 border-indigo-800 hover:bg-indigo-700 active:translate-y-0.5 flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>NUEVA PARTIDA</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* SCREEN 4: LEARN (MODO APRENDIZAJE) */}
          {step === 'learn' && (
            <motion.div
              key="learn"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full h-full max-h-full bg-white rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] shadow-xl md:shadow-2xl p-3 sm:p-5 md:p-6 lg:p-8 border-2 sm:border-4 md:border-8 border-sky-100 flex flex-col justify-between overflow-hidden"
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-2 sm:pb-3 border-b border-slate-100 flex-shrink-0">
                <button
                  onClick={() => {
                    if (learningTable) setLearningTable(null);
                    else setStep('setup');
                  }}
                  className="p-1.5 sm:p-2 md:p-3 bg-slate-50 text-slate-500 hover:text-slate-700 rounded-xl md:rounded-2xl border border-slate-200 transition-all shadow-xs active:scale-95"
                  title="Volver"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                </button>

                <h2 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-indigo-600">
                  {learningTable ? `Tabla del ${learningTable}` : 'Modo Estudio: Tablas del 2 al 9'}
                </h2>

                <button
                  onClick={() => setStep('setup')}
                  className="p-1.5 sm:p-2 md:p-3 bg-slate-50 text-slate-500 hover:text-slate-700 rounded-xl md:rounded-2xl border border-slate-200 transition-all shadow-xs active:scale-95"
                  title="Inicio"
                >
                  <Home className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                </button>
              </div>

              {/* Body */}
              {!learningTable ? (
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-2 text-center overflow-hidden">
                  <p className="text-xs sm:text-sm md:text-base text-slate-400 font-bold mb-3 md:mb-5">
                    Elige qué tabla quieres repasar:
                  </p>
                  <div className="grid grid-cols-4 gap-2.5 sm:gap-3.5 md:gap-4 w-full max-w-4xl">
                    {AVAILABLE_TABLES.map((num) => {
                      const theme = TABLE_THEMES[num];
                      return (
                        <motion.button
                          key={num}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setLearningTable(num)}
                          className={`
                            h-16 sm:h-20 md:h-28 lg:h-32 rounded-xl sm:rounded-2xl font-black transition-all border-b-3 sm:border-b-4 md:border-b-5 shadow-sm flex flex-col items-center justify-center
                            ${theme.bg} ${theme.text} ${theme.border} hover:brightness-95
                          `}
                        >
                          <span className="text-2xl sm:text-4xl md:text-5xl leading-none">{num}</span>
                          <span className="text-[10px] sm:text-xs md:text-sm opacity-75 mt-0.5 sm:mt-1">Tabla del {num}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col justify-between py-2 sm:py-3 overflow-hidden">
                  {/* Display 10 operations in 2 columns of 5 */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 flex-1 min-h-0">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((multiplier) => (
                      <div
                        key={multiplier}
                        className="bg-slate-50/80 px-2.5 sm:px-4 md:px-5 py-1 sm:py-2 md:py-3 rounded-xl md:rounded-2xl border border-slate-200 flex items-center justify-between text-xs sm:text-base md:text-xl font-black shadow-2xs"
                      >
                        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 text-slate-600">
                          <span className="text-indigo-600">{learningTable}</span>
                          <span className="text-slate-400">×</span>
                          <span>{multiplier}</span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className="text-slate-300">=</span>
                          <span className="text-emerald-600 text-sm sm:text-lg md:text-2xl">
                            {learningTable * multiplier}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 sm:pt-3 flex-shrink-0">
                    <button
                      onClick={() => setLearningTable(null)}
                      className="w-full py-2.5 sm:py-3 md:py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-xl md:rounded-2xl font-black text-xs sm:text-sm md:text-base border-b-2 sm:border-b-4 border-sky-700 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>ELEGIR OTRA TABLA</span>
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
    </>
  );
}
