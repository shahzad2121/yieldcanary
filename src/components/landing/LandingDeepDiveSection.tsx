import { motion, useReducedMotion } from 'framer-motion';
import { Clock, DollarSign, History, TrendingDown, TrendingUp } from 'lucide-react';
import { ZoomableImage } from '@/components/landing/ZoomableImage';
import { useTheme } from '@/hooks/useTheme';

/* ─────────────────────────────────────────────
   Feature highlights
───────────────────────────────────────────── */
const FEATURES = [
  {
    icon: TrendingDown,
    label: 'True Income Yield',
    detail: 'Strips out return-of-capital so you see exactly what you keep.',
  },
  {
    icon: TrendingUp,
    label: 'ROC Trends',
    detail: 'Track whether a fund is bleeding capital over time.',
  },
  {
    icon: Clock,
    label: 'Death Clock',
    detail: 'Years until 50 % NAV erosion at the current bleed rate.',
  },
  {
    icon: DollarSign,
    label: 'Take-Home Cash Return',
    detail: 'Real after-tax income — not the number printed on the label.',
  },
  {
    icon: History,
    label: 'Full Distribution History',
    detail: 'Every dividend, ROC split, and true-income bar — all in one chart.',
  },
] as const;

/* ─────────────────────────────────────────────
   Section
───────────────────────────────────────────── */
export function LandingDeepDiveSection() {
  const reduceMotion = useReducedMotion();
  const { theme } = useTheme();
  const deepDiveImageSrc =
    theme === 'light' ? '/landing/etf-deep-dive-light.png' : '/landing/etf-deep-dive-dark.png';

  const fadeUp = (delay = 0) => ({
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 },
    whileInView: reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 as const },
    transition: reduceMotion
      ? { duration: 0.2 }
      : { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const, delay },
  });

  return (
    <section
      id="deep-dive"
      aria-labelledby="deep-dive-heading"
      className="border-t border-border/50 bg-background py-16 sm:py-20 lg:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:items-center lg:gap-14 xl:gap-20">

          {/* ── LEFT: copy ── */}
          <div className="mb-12 lg:mb-0">

            {/* Kicker */}
            <motion.p
              {...fadeUp(0)}
              className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
            >
              ETF Deep Dive
            </motion.p>

            {/* Headline */}
            <motion.h2
              {...fadeUp(0.06)}
              id="deep-dive-heading"
              className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[2.6rem] lg:leading-[1.15]"
            >
              Deep dive into any ETF
              <br className="hidden sm:block" />
              <span className="text-primary"> in one click.</span>
            </motion.h2>

            {/* Description */}
            <motion.p
              {...fadeUp(0.12)}
              className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Click any ticker and instantly see everything that matters — no more
              hunting through fund fact sheets or guessing from yield numbers alone.
            </motion.p>

            {/* Feature list */}
            <motion.ul
              {...fadeUp(0.18)}
              className="mt-8 space-y-4"
            >
              {FEATURES.map(({ icon: Icon, label, detail }) => (
                <li key={label} className="flex items-start gap-3.5">
                  {/* Icon bubble */}
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                    <Icon className="h-4 w-4 text-primary" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-foreground">
                      {label}
                    </span>
                    <span className="block text-sm leading-snug text-muted-foreground">
                      {detail}
                    </span>
                  </span>
                </li>
              ))}
            </motion.ul>
          </div>

          {/* ── RIGHT: screenshot ── */}
          <motion.div
            {...fadeUp(0.1)}
            className="relative"
          >
            {/* Ambient glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-8 rounded-3xl bg-gradient-to-br from-primary/8 via-transparent to-primary/12 blur-3xl"
            />

            {/* Frame */}
            <div className="relative rounded-[20px] bg-gradient-to-b from-muted/50 via-muted/20 to-transparent p-[1.5px] shadow-[0_32px_72px_-16px_rgba(0,0,0,0.28)] dark:shadow-[0_32px_72px_-16px_rgba(0,0,0,0.55)]">
              <div className="overflow-hidden rounded-[18px] bg-card ring-1 ring-border/50">
                <ZoomableImage
                  src={deepDiveImageSrc}
                  alt="YieldCanary ETF Deep Dive modal showing True Income Yield, ROC trends, Death Clock and full distribution history"
                  frameClassName="rounded-[18px]"
                  imageClassName="block h-auto w-full"
                />
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
