import { useState, useEffect, useCallback, useRef } from 'react';

const BASE_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to the Flavor Network',
    content:
      'A neural map of ingredient relationships. Each glowing node is an ingredient. ' +
      'Connections show flavor pairings discovered from culinary data.',
    action: null,
    waitFor: null,
  },
  {
    id: 'navigation',
    title: 'Navigate the Network',
    content:
      'Drag to rotate the view. Scroll to zoom in and out. Shift+drag to pan. ' +
      'Try rotating the scene now, or press Next to continue.',
    action: null,
    waitFor: 'drag',
  },
  {
    id: 'fly-to-garlic',
    title: 'Exploring Garlic',
    content:
      'This is garlic — one of the most connected ingredients in the network. ' +
      'It pairs well with hundreds of other flavors across many cuisines.',
    action: 'flyToGarlic',
    waitFor: null,
  },
  {
    id: 'ingredient-panel',
    title: 'Ingredient Details',
    content:
      'Click any node to open its detail panel. You will find pairings, cuisines, ' +
      'taste profiles, affinities, and tips — all sourced from the Flavor Bible.',
    action: null,
    waitFor: null,
  },
  {
    id: 'activation-spread',
    title: 'Activation Spread',
    content:
      'When you select an ingredient, connected nodes light up. Brighter glow means a ' +
      'stronger pairing. This visualizes the neural network of flavor relationships.',
    action: null,
    waitFor: null,
  },
  {
    id: 'search-demo',
    title: 'Search Ingredients',
    content:
      'Use the search bar at the top to find any ingredient instantly. ' +
      'Try searching for "basil" to see autocomplete in action.',
    action: 'demoSearch',
    waitFor: null,
  },
  {
    id: 'comparison-mode',
    title: 'Compare Ingredients',
    content:
      'Select two ingredients to compare them side by side. You will see their shared ' +
      'pairings and discover unexpected flavor bridges between them.',
    action: null,
    waitFor: null,
  },
  {
    id: 'filters',
    title: 'Filter and Focus',
    content:
      'Use the controls to filter ingredients by cuisine, taste profile, or season. ' +
      'This helps you focus your exploration on specific culinary traditions.',
    action: null,
    waitFor: null,
  },
  {
    id: 'profile-add',
    title: 'Build Your Flavor Profile',
    content:
      'Click the edit (pencil) icon in the top-left to open your profile panel. ' +
      'Add your favorite ingredients, cuisines, and recipes to create a personal flavor profile. ' +
      'You can also hover over any node and click the heart icon to quick-add it.',
    action: null,
    waitFor: null,
  },
  {
    id: 'profile-view',
    title: 'Your Personal View',
    content:
      'Switch between "Global" and "My Profile" using the toggle in the top-left. ' +
      'In profile mode, nodes scale up based on your preferences — your favorites glow brighter ' +
      'and connect more prominently.',
    action: null,
    waitFor: null,
  },
  {
    id: 'profile-insights',
    title: 'Discover Your Flavor Signature',
    content:
      'Click the chart icon to see your Profile Insights: your taste breakdown, top ingredients, ' +
      'cuisine affinity, and personalized "you might like" suggestions. ' +
      'Export your profile anytime to share or back it up.',
    action: null,
    waitFor: null,
  },
  {
    id: 'recipe-scanning',
    title: 'Import Recipes',
    content:
      'Paste a recipe URL or scan a printed recipe with your camera to auto-extract ingredients. ' +
      'Find these options in your profile panel under the Recipes tab.',
    action: null,
    waitFor: null,
  },
  {
    id: 'tree-explorer',
    title: 'Flavor Trees',
    content:
      'Click the grid icon (top-right) to explore the Flavor Tree — browse ingredients by ' +
      'Cuisine, Taste, Family, or Season. Shift+click two nodes to compare them.',
    action: null,
    waitFor: null,
  },
  {
    id: 'flavor-dna',
    title: 'Your Flavor DNA',
    content:
      'In profile mode, open your Flavor Tree and click "DNA" to see your Flavor DNA — ' +
      'a radar chart showing which world cuisines your palate aligns with. ' +
      'Download a Flavor Passport to share your profile.',
    action: null,
    waitFor: null,
  },
  {
    id: 'complete',
    title: "You're Ready to Explore!",
    content:
      'You now know the essentials. Click the "?" button anytime to replay this tour. ' +
      'Happy exploring!',
    action: null,
    waitFor: null,
  },
];

const QUIZ_STEP = {
  id: 'quiz-prompt',
  title: 'Discover Your Palate',
  content:
    'Want a personalized experience right away? Take a quick 2-minute quiz to ' +
    'identify your flavor preferences. You can always skip this and come back later.',
  action: null,
  waitFor: null,
  quizPrompt: true,
};

function buildSteps(hasProfile) {
  if (hasProfile) return BASE_STEPS;
  // Insert quiz prompt after step 3 (fly-to-garlic, index 2)
  const steps = [...BASE_STEPS];
  steps.splice(3, 0, QUIZ_STEP);
  return steps;
}

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

function Walkthrough({ active, onComplete, onSkip, sceneManager, hasProfile, onStartQuiz }) {
  const steps = buildSteps(hasProfile);
  const totalSteps = steps.length;
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const dragDetectedRef = useRef(false);

  // Show/hide based on active prop
  useEffect(() => {
    if (active) {
      setCurrentStep(0);
      setVisible(true);
      dragDetectedRef.current = false;
      // Trigger fade-in on next frame
      requestAnimationFrame(() => {
        setFadeIn(true);
      });
    } else {
      setFadeIn(false);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [active]);

  // Listen for drag events on step 1 (navigation)
  useEffect(() => {
    if (!active || currentStep !== 1) return;

    let mouseDown = false;
    let moved = false;

    const handleMouseDown = () => {
      mouseDown = true;
      moved = false;
    };

    const handleMouseMove = () => {
      if (mouseDown && !moved) {
        moved = true;
        dragDetectedRef.current = true;
        // Auto-advance after brief delay so user sees result
        setTimeout(() => {
          setCurrentStep((prev) => (prev === 1 ? 2 : prev));
        }, 800);
      }
    };

    const handleMouseUp = () => {
      mouseDown = false;
    };

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

  // Execute step actions when step changes
  useEffect(() => {
    if (!active) return;

    const step = steps[currentStep];
    if (!step || !step.action || !sceneManager) return;

    if (step.action === 'flyToGarlic') {
      // Fly camera toward a position where garlic would likely be
      const camera = sceneManager.getCamera();
      if (camera) {
        const startPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
        const targetPos = { x: 15, y: 5, z: 40 };
        const duration = 1500;
        const startTime = performance.now();

        function animateFly(now) {
          const elapsed = now - startTime;
          const t = Math.min(elapsed / duration, 1);
          // Ease in-out cubic
          const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

          camera.position.set(
            startPos.x + (targetPos.x - startPos.x) * ease,
            startPos.y + (targetPos.y - startPos.y) * ease,
            startPos.z + (targetPos.z - startPos.z) * ease
          );

          if (t < 1) {
            requestAnimationFrame(animateFly);
          }
        }

        requestAnimationFrame(animateFly);
      }
    }
  }, [active, currentStep, sceneManager]);

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

  if (!visible) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div
      className={
        'fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-300 ' +
        (fadeIn ? 'opacity-100' : 'opacity-0')
      }
      style={{ pointerEvents: fadeIn ? 'auto' : 'none' }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60" onClick={handleSkip} />

      {/* Step card */}
      <div
        className={
          'relative z-10 w-full max-w-md mx-4 ' +
          'bg-[#12121a]/95 backdrop-blur-md border border-[#1e1e2e] rounded-lg ' +
          'p-6 shadow-2xl'
        }
      >
        {/* Step counter */}
        <p className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold mb-3">
          Step {currentStep + 1} of {totalSteps}
        </p>

        {/* Title */}
        <h2
          className="text-xl font-bold text-gray-100 mb-2"
          style={{
            textShadow:
              '0 0 20px rgba(56, 189, 248, 0.4), 0 0 40px rgba(139, 92, 246, 0.2)',
          }}
        >
          {step.title}
        </h2>

        {/* Content */}
        <p className="text-sm text-gray-400 leading-relaxed mb-4">{step.content}</p>

        {/* Quiz prompt button */}
        {step.quizPrompt && onStartQuiz && (
          <button
            onClick={() => {
              handleSkip();
              setTimeout(() => onStartQuiz(), 350);
            }}
            className="w-full mb-4 py-2.5 rounded-lg text-sm font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 hover:border-purple-500/50 transition-all"
          >
            Take the Palate Quiz
          </button>
        )}

        {/* Progress dots */}
        <ProgressDots current={currentStep} total={totalSteps} />

        {/* Footer actions */}
        <div className="flex items-center justify-between mt-5">
          <button
            onClick={handleSkip}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors focus:outline-none"
          >
            Skip Tour
          </button>

          <button
            onClick={handleNext}
            className={
              'px-4 py-2 rounded-md text-sm font-medium transition-all focus:outline-none ' +
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
