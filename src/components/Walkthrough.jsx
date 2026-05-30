import { useState, useEffect, useCallback, useRef } from 'react';

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to the Flavor Network',
    content:
      'A neural map of ingredient relationships. Each glowing node is an ingredient. ' +
      'Connections show flavor pairings discovered from culinary data.',
  },
  {
    id: 'navigation',
    title: 'Navigate the Network',
    content:
      'Drag to rotate the view. Scroll to zoom in and out. Shift+drag to pan. ' +
      'Click any node to see its pairings, cuisines, and taste profile.',
    waitFor: 'drag',
  },
  {
    id: 'network',
    title: 'Explore the NeuFlavor Network',
    content:
      'Use the search bar to find any ingredient. Select multiple ingredients to see how they connect. ' +
      'Use the Controls panel to filter by cuisine or taste.',
  },
  {
    id: 'guided',
    title: 'Guided Discovery',
    content:
      "Tell us what you're cooking and we'll find pairings that fit. " +
      'Pick from thought bubbles like "goes with a season" or "is for a cocktail" — ' +
      'stack as many as you want.',
  },
  {
    id: 'explore',
    title: 'Explore Tools',
    content:
      'Open the Explore menu to browse Flavor Trees by category, find Flavor Bridges between ingredients, ' +
      'or view Network Insights for global statistics.',
  },
  {
    id: 'labs',
    title: 'Recipe Labs',
    content:
      'Switch to the Labs tab to plan recipes visually. Recipe Lab lets you build dishes ingredient by ingredient. ' +
      'Cocktail Lab and Sauce Lab offer specialized frameworks for drinks and sauces.',
  },
  {
    id: 'profile',
    title: 'Your Flavor Profile',
    content:
      'Click the Profile icon to save favorite ingredients, cuisines, and recipes. ' +
      'Toggle to Profile view to see the network weighted by your preferences. ' +
      'Check the Insights tab for your flavor signature and personalized suggestions.',
  },
  {
    id: 'complete',
    title: "You're Ready to Explore!",
    content:
      'You now know the essentials. Click the "?" button anytime to replay this tour. ' +
      'Happy exploring!',
  },
];

function ProgressDots({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mt-4">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={
            'block w-1.5 h-1.5 rounded-full transition-all duration-300 ' +
            (i === current
              ? 'bg-cyan-400 w-3'
              : i < current
                ? 'bg-cyan-400/40'
                : 'bg-gray-600')
          }
        />
      ))}
    </div>
  );
}

// GD-WALKTHROUGH-TOUR-MUTEX (2026-05-30): `suppress` lets the parent
// hide this first-run modal while the GuidedTour overlay (the Guided
// Discovery → network handoff) is active. The two surfaces are
// distinct first-impression paths and shouldn't stack — see the Wave-7
// contact-sheet frame 4 for the bug this gates against.
function Walkthrough({ active, onComplete, onSkip, suppress = false }) {
  const totalSteps = STEPS.length;
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const dragDetectedRef = useRef(false);

  useEffect(() => {
    if (active) {
      setCurrentStep(0);
      setVisible(true);
      dragDetectedRef.current = false;
      requestAnimationFrame(() => {
        setFadeIn(true);
      });
    } else {
      setFadeIn(false);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [active]);

  // Listen for drag events on navigation step
  useEffect(() => {
    if (!active || currentStep !== 1) return;

    let mouseDown = false;
    let moved = false;

    const handleMouseDown = () => { mouseDown = true; moved = false; };
    const handleMouseMove = () => {
      if (mouseDown && !moved) {
        moved = true;
        dragDetectedRef.current = true;
        setTimeout(() => {
          setCurrentStep((prev) => (prev === 1 ? 2 : prev));
        }, 800);
      }
    };
    const handleMouseUp = () => { mouseDown = false; };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchstart', handleMouseDown);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchstart', handleMouseDown);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [active, currentStep]);

  const handleNext = useCallback(() => {
    if (currentStep >= totalSteps - 1) {
      localStorage.setItem('flavor-tour-complete', 'true');
      setFadeIn(false);
      setTimeout(() => {
        setVisible(false);
        if (onComplete) onComplete();
      }, 300);
      return;
    }
    setCurrentStep((prev) => prev + 1);
  }, [currentStep, onComplete]);

  const handleSkip = useCallback(() => {
    setFadeIn(false);
    setTimeout(() => {
      setVisible(false);
      if (onSkip) onSkip();
    }, 300);
  }, [onSkip]);

  if (suppress) return null;
  if (!visible) return null;

  const step = STEPS[currentStep];
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div
      className={
        'fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-300 ' +
        (fadeIn ? 'opacity-100' : 'opacity-0')
      }
      style={{ pointerEvents: fadeIn ? 'auto' : 'none' }}
    >
      <div className="absolute inset-0 bg-black/60" onClick={handleSkip} />

      <div
        className={
          'relative z-10 w-full max-w-md mx-4 ' +
          'bg-[#12121a]/95 backdrop-blur-md border border-[#1e1e2e] rounded-lg ' +
          'p-6 shadow-2xl'
        }
      >
        <p className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold mb-3">
          Step {currentStep + 1} of {totalSteps}
        </p>

        <h2
          className="text-xl font-bold text-gray-100 mb-2"
          style={{
            textShadow:
              '0 0 20px rgba(56, 189, 248, 0.4), 0 0 40px rgba(139, 92, 246, 0.2)',
          }}
        >
          {step.title}
        </h2>

        <p className="text-sm text-gray-400 leading-relaxed mb-4">{step.content}</p>

        <ProgressDots current={currentStep} total={totalSteps} />

        <div className="flex items-center justify-between mt-5">
          <button
            onClick={handleSkip}
            className="min-h-[44px] px-3 text-xs text-gray-500 hover:text-gray-300 transition-colors focus:outline-none flex items-center"
          >
            Skip Tour
          </button>

          <button
            onClick={handleNext}
            className={
              'min-h-[44px] px-4 py-2 rounded-md text-sm font-medium transition-all focus:outline-none ' +
              'focus:ring-1 focus:ring-cyan-500 ' +
              'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 ' +
              'hover:bg-cyan-600/30 hover:border-cyan-500/50 ' +
              'hover:shadow-[0_0_15px_rgba(6,182,212,0.25)]'
            }
          >
            {isLastStep ? 'Start Exploring' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Walkthrough;
