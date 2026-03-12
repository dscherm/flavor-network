import { useState, useCallback, useEffect } from 'react';

// Minimal question set for the quiz engine — TASK-79 will build the full question bank
const DEFAULT_QUESTIONS = [
  {
    id: 'heat',
    type: 'scale',
    title: 'Heat Tolerance',
    question: 'How spicy do you like your food?',
    labels: ['Mild', 'Medium', 'Hot', 'Very Hot', 'Extreme'],
  },
  {
    id: 'sweet_savory',
    type: 'choice',
    title: 'Sweet vs Savory',
    question: 'When snacking, do you reach for sweet or savory?',
    options: ['Sweet', 'Savory', 'Both equally'],
  },
  {
    id: 'herbs',
    type: 'multi',
    title: 'Herb Preferences',
    question: 'Pick your top 3 herbs:',
    options: ['Basil', 'Cilantro', 'Parsley', 'Rosemary', 'Thyme', 'Mint', 'Dill', 'Oregano', 'Tarragon', 'Chives'],
    max: 3,
  },
  {
    id: 'acid',
    type: 'scale',
    title: 'Acid Tolerance',
    question: 'Do you squeeze lemon or lime on everything?',
    labels: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'],
  },
  {
    id: 'umami',
    type: 'choice',
    title: 'Umami Seeking',
    question: 'Do you add soy sauce, parmesan, or mushrooms to boost flavor?',
    options: ['Rarely', 'Sometimes', 'Frequently', 'Every chance I get'],
  },
  {
    id: 'aromas',
    type: 'multi',
    title: 'Aromatic Preferences',
    question: 'Which aromas appeal to you most? (pick 3)',
    options: ['Smoky', 'Floral', 'Earthy', 'Citrusy', 'Herbal', 'Nutty', 'Buttery', 'Spicy'],
    max: 3,
  },
  {
    id: 'cooking_fat',
    type: 'choice',
    title: 'Cooking Fat',
    question: 'Your go-to cooking fat?',
    options: ['Butter', 'Olive oil', 'Coconut oil', 'Sesame oil', 'Ghee', 'Neutral oil'],
  },
  {
    id: 'bitter',
    type: 'scale',
    title: 'Bitter Appreciation',
    question: 'Do you enjoy dark chocolate, coffee, or hoppy beer?',
    labels: ['Not at all', 'A little', 'Moderately', 'Quite a bit', 'Love them'],
  },
  {
    id: 'texture',
    type: 'choice',
    title: 'Texture Preference',
    question: 'Crunchy or creamy?',
    options: ['Crunchy', 'Creamy', 'Both equally'],
  },
  {
    id: 'adventure',
    type: 'scale',
    title: 'Culinary Adventure',
    question: 'How adventurous are you with unfamiliar cuisines?',
    labels: ['Very cautious', 'Somewhat cautious', 'Open', 'Adventurous', 'Will try anything'],
  },
];

export default function PalateQuiz({ active, onComplete, onSkip, questions }) {
  const items = questions || DEFAULT_QUESTIONS;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [fadeIn, setFadeIn] = useState(false);
  const [slideDir, setSlideDir] = useState('right'); // animation direction

  useEffect(() => {
    if (active) {
      setFadeIn(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setFadeIn(true)));
    } else {
      setFadeIn(false);
      setStep(0);
      setAnswers({});
    }
  }, [active]);

  const current = items[step];
  const total = items.length;
  const progress = ((step) / total) * 100;

  const currentAnswer = answers[current?.id];
  const canProceed = currentAnswer !== undefined && currentAnswer !== null &&
    (Array.isArray(currentAnswer) ? currentAnswer.length > 0 : true);

  const handleScaleSelect = useCallback((value) => {
    setAnswers(prev => ({ ...prev, [current.id]: value }));
  }, [current]);

  const handleChoiceSelect = useCallback((option) => {
    setAnswers(prev => ({ ...prev, [current.id]: option }));
  }, [current]);

  const handleMultiToggle = useCallback((option) => {
    setAnswers(prev => {
      const existing = prev[current.id] || [];
      if (existing.includes(option)) {
        return { ...prev, [current.id]: existing.filter(o => o !== option) };
      }
      if (current.max && existing.length >= current.max) {
        return prev; // at max selections
      }
      return { ...prev, [current.id]: [...existing, option] };
    });
  }, [current]);

  const goNext = useCallback(() => {
    if (step < total - 1) {
      setSlideDir('right');
      setStep(s => s + 1);
    } else {
      // Quiz complete
      if (onComplete) onComplete(answers);
    }
  }, [step, total, answers, onComplete]);

  const goBack = useCallback(() => {
    if (step > 0) {
      setSlideDir('left');
      setStep(s => s - 1);
    }
  }, [step]);

  const handleSkip = useCallback(() => {
    if (onSkip) onSkip();
  }, [onSkip]);

  if (!active || !current) return null;

  const renderQuestion = () => {
    switch (current.type) {
      case 'scale':
        return (
          <div className="flex flex-col gap-2 mt-4">
            <div className="flex justify-between items-center gap-1">
              {current.labels.map((label, i) => (
                <button
                  key={label}
                  onClick={() => handleScaleSelect(i)}
                  className={`flex-1 py-2.5 px-1 rounded-lg text-xs font-medium transition-all duration-200 border ${
                    currentAnswer === i
                      ? 'bg-neural-glow/20 border-neural-glow text-neural-glow shadow-[0_0_12px_rgba(79,143,255,0.3)]'
                      : 'bg-[#1a1a2e]/60 border-[#2a2a3e] text-gray-400 hover:border-gray-500 hover:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        );

      case 'choice':
        return (
          <div className="flex flex-col gap-2 mt-4">
            {current.options.map(option => (
              <button
                key={option}
                onClick={() => handleChoiceSelect(option)}
                className={`w-full py-3 px-4 rounded-lg text-sm text-left transition-all duration-200 border ${
                  currentAnswer === option
                    ? 'bg-neural-glow/20 border-neural-glow text-neural-glow shadow-[0_0_12px_rgba(79,143,255,0.3)]'
                    : 'bg-[#1a1a2e]/60 border-[#2a2a3e] text-gray-300 hover:border-gray-500 hover:text-white'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        );

      case 'multi':
        return (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">
              Select up to {current.max || 'any number of'} options
            </p>
            <div className="flex flex-wrap gap-2">
              {current.options.map(option => {
                const selected = (currentAnswer || []).includes(option);
                const atMax = current.max && (currentAnswer || []).length >= current.max && !selected;
                return (
                  <button
                    key={option}
                    onClick={() => handleMultiToggle(option)}
                    disabled={atMax}
                    className={`py-2 px-3.5 rounded-full text-sm transition-all duration-200 border ${
                      selected
                        ? 'bg-neural-glow/20 border-neural-glow text-neural-glow shadow-[0_0_10px_rgba(79,143,255,0.25)]'
                        : atMax
                          ? 'bg-[#1a1a2e]/30 border-[#1e1e2e] text-gray-600 cursor-not-allowed'
                          : 'bg-[#1a1a2e]/60 border-[#2a2a3e] text-gray-300 hover:border-gray-500 hover:text-white'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[110] flex items-center justify-center transition-opacity duration-300 ${
        fadeIn ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleSkip} />

      {/* Quiz card */}
      <div className="relative z-10 w-full max-w-lg mx-4">
        <div className="bg-[#12121a]/95 backdrop-blur-md border border-[#1e1e2e] rounded-2xl shadow-2xl overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-[#1a1a2e]">
            <div
              className="h-full bg-gradient-to-r from-neural-glow to-purple-500 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Header */}
          <div className="px-6 pt-5 pb-2 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                Palate Discovery
              </p>
              <p className="text-[11px] text-gray-600 mt-0.5">
                Question {step + 1} of {total}
              </p>
            </div>
            <button
              onClick={handleSkip}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1"
            >
              Skip quiz
            </button>
          </div>

          {/* Question content */}
          <div className="px-6 pb-2">
            <h3 className="text-lg font-semibold text-white mb-1" style={{ textShadow: '0 0 20px rgba(79,143,255,0.2)' }}>
              {current.title}
            </h3>
            <p className="text-sm text-gray-300">{current.question}</p>
            {renderQuestion()}
          </div>

          {/* Navigation */}
          <div className="px-6 py-4 flex items-center justify-between border-t border-[#1e1e2e]/50 mt-4">
            <button
              onClick={goBack}
              disabled={step === 0}
              className={`flex items-center gap-1.5 text-sm transition-colors ${
                step === 0
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            {/* Step dots */}
            <div className="flex gap-1.5">
              {items.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    i === step
                      ? 'bg-neural-glow w-4 shadow-[0_0_6px_rgba(79,143,255,0.5)]'
                      : i < step && answers[items[i].id] !== undefined
                        ? 'bg-neural-glow/50'
                        : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={goNext}
              disabled={!canProceed}
              className={`flex items-center gap-1.5 text-sm font-medium transition-all ${
                canProceed
                  ? 'text-neural-glow hover:text-white'
                  : 'text-gray-600 cursor-not-allowed'
              }`}
            >
              {step === total - 1 ? 'Finish' : 'Next'}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
