import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ZoomableImage } from '@/components/landing/ZoomableImage';
import { useTheme } from '@/hooks/useTheme';

/* ─────────────────────────────────────────────
   Data
───────────────────────────────────────────── */
type InsightStep = {
  id: string;
  imageSrcLight: string;
  imageSrcDark: string;
  imageAlt: string;
  heading: string;
  description: string;
};

const STEPS: InsightStep[] = [
  {
    id: 'live-market-snapshot',
    imageSrcLight: '/landing/insights/insights-1-light.png',
    imageSrcDark: '/landing/insights/insights-1-dark.png',
    imageAlt: 'YieldCanary live market snapshot',
    heading: 'Live Market Snapshot',
    description:
      'Track major indices and market signals in real time. Updated every two minutes to give you a quick pulse of the market.',
  },
  {
    id: 'largest-efficient-funds',
    imageSrcLight: '/landing/insights/insights-2-light.png',
    imageSrcDark: '/landing/insights/insights-2-dark.png',
    imageAlt: 'Largest healthy ETFs by AUM and lowest expense ratio funds',
    heading: 'Largest & Most Efficient Funds',
    description:
      'Quickly identify the largest healthy ETFs and those with the lowest expense ratios, helping you keep more of your yield.',
  },
  {
    id: 'sustainable-high-yield',
    imageSrcLight: '/landing/insights/insights-3-light.png',
    imageSrcDark: '/landing/insights/insights-3-dark.png',
    imageAlt: 'Highest yielding ETFs with no NAV erosion',
    heading: 'Sustainable High Yield Opportunities',
    description:
      'Discover ETFs delivering strong yield without NAV erosion — designed for long-term income stability.',
  },
  {
    id: 'avoid-yield-traps',
    imageSrcLight: '/landing/insights/insights-4-light.png',
    imageSrcDark: '/landing/insights/insights-4-dark.png',
    imageAlt: 'High advertised yield funds that may erode capital',
    heading: 'Avoid Yield Traps',
    description:
      'Spot funds with high advertised yields that may be eroding capital, so you can make smarter income decisions.',
  },
];

/* ─────────────────────────────────────────────
   Screenshot frame — NO fixed height, NO aspect-ratio.
   w-full lets the image fill the column width;
   h-auto lets each image keep its own natural height.
───────────────────────────────────────────── */
function InsightScreenshot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative rounded-[20px] bg-gradient-to-b from-muted/50 via-muted/25 to-transparent p-[1.5px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.22)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
      <div className="overflow-hidden rounded-[18px] bg-card ring-1 ring-border/50">
        <ZoomableImage
          src={src}
          alt={alt}
          frameClassName="rounded-[18px]"
          imageClassName="block h-auto w-full"
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Progress dots
───────────────────────────────────────────── */
function StepDots({ count, active }: { count: number; active: number }) {
  return (
    <div className="mt-8 flex items-center gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={[
            'h-[3px] rounded-full transition-all duration-500',
            i === active ? 'w-8 bg-primary' : 'w-2.5 bg-muted-foreground/25',
          ].join(' ')}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main section
───────────────────────────────────────────── */
export function LandingInsightsSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const { theme } = useTheme();

  /*
    Refs for each image element (not the full panel).
    On every scroll we find which image's center is closest to a fixed
    "target line" 38 % from the top of the viewport. Because we compare
    distances, exactly one image always wins — even when multiple images
    are visible simultaneously.
  */
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const TARGET_RATIO = 0.38; // 38 % from viewport top

    const handleScroll = () => {
      const targetY = window.innerHeight * TARGET_RATIO;
      let bestIndex = 0;
      let minDist = Infinity;

      imageRefs.current.forEach((el, i) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const dist = Math.abs(mid - targetY);
        if (dist < minDist) {
          minDist = dist;
          bestIndex = i;
        }
      });

      setActiveIndex((prev) => (prev === bestIndex ? prev : bestIndex));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // run once on mount
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const active = STEPS[activeIndex];

  const textVariants = {
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 },
    animate: reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
    exit:    reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14 },
  };

  const textTransition = reduceMotion
    ? { duration: 0.18 }
    : { duration: 0.46, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <section
      id="insights"
      aria-labelledby="insights-heading"
      className="border-t border-border/50 bg-muted/15 py-16 sm:py-20 lg:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Section kicker ── */}
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Insights
        </p>
        <h2
          id="insights-heading"
          className="mb-12 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:mb-20"
        >
          See the market clearly
        </h2>

        {/*
          ── Two-column grid ──

          LEFT  (60 %): images scroll at their own natural heights.
          RIGHT (40 %): text is sticky — updates as images scroll into view.

          The grid stretches both columns to the same height by default, which
          gives the sticky right column a tall enough scroll container to work in.
          No items-start, no height locking anywhere.
        */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:gap-12 xl:gap-16">

          {/* ── LEFT: scrolling images ── */}
          <div className="flex flex-col">
            {STEPS.map((step, index) => (
              <motion.div
                key={step.id}
                /* Fade + subtle lift as each image scrolls in */
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
                whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.15 }}
                transition={{
                  duration: reduceMotion ? 0.15 : 0.5,
                  ease: 'easeOut',
                }}
                /* Generous vertical padding creates breathing room between
                   images and ensures the scroll tracker has time to update. */
                className="py-10 lg:py-16"
              >
                {/* ref is on the image frame, not the whole panel (which
                    includes padding), so distance is measured to the image
                    itself — giving accurate per-image tracking. */}
                <div ref={(el) => { imageRefs.current[index] = el; }}>
                  <InsightScreenshot
                    src={theme === 'light' ? step.imageSrcLight : step.imageSrcDark}
                    alt={step.imageAlt}
                  />
                </div>

                {/* Mobile-only: text below each image */}
                <div className="mt-6 lg:hidden">
                  <div className="mb-4 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 ring-1 ring-primary/20">
                    <span className="text-xs font-semibold text-primary">
                      {String(index + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight text-foreground">
                    {step.heading}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── RIGHT: sticky text (desktop only) ── */}
          <div className="relative hidden lg:block">
            {/*
              sticky top-28 pins the text panel 112 px from the top of the
              viewport. It scrolls within its grid column, which stretches to
              match the full height of the image column on the left.
            */}
            <div className="sticky top-28">

              {/* Ambient glow behind text */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-8 rounded-3xl bg-gradient-to-br from-primary/5 via-transparent to-primary/8 blur-3xl"
              />

              <AnimatePresence mode="wait">
                <motion.div
                  key={active.id}
                  variants={textVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={textTransition}
                  className="relative"
                >
                  {/* Step badge */}
                  <div className="mb-6 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 ring-1 ring-primary/20">
                    <span className="text-xs font-semibold text-primary">
                      {String(activeIndex + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
                    </span>
                  </div>

                  <h3 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    {active.heading}
                  </h3>
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                    {active.description}
                  </p>
                </motion.div>
              </AnimatePresence>

              <StepDots count={STEPS.length} active={activeIndex} />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
