import { useTheme } from '@/hooks/useTheme';
import { ZoomableImage } from '@/components/landing/ZoomableImage';

export function LandingPortfolioSection() {
  const { theme } = useTheme();
  const imageSrc = theme === 'light' ? '/landing/portfolio-light.png' : '/landing/portfolio.png';

  return (
    <section
      id="portfolio-coming-soon"
      aria-labelledby="portfolio-coming-soon-heading"
      className="border-t border-border/50 bg-muted/10 py-16 sm:py-20 lg:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)] lg:items-center lg:gap-14 xl:gap-20">
          <div className="mb-10 lg:mb-0">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Section 4
            </p>
            <div className="mb-4 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary ring-1 ring-primary/20">
              Coming Soon
            </div>
            <h2
              id="portfolio-coming-soon-heading"
              className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[2.55rem] lg:leading-[1.15]"
            >
              Coming Soon: Personal Portfolio Health Tracker
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Link your holdings and see your weighted Death Clock, overall Canary Status,
              portfolio ROC exposure, and estimated monthly spendable cash.
            </p>
          </div>

          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-8 rounded-3xl bg-gradient-to-br from-primary/7 via-transparent to-primary/10 blur-3xl"
            />
            <div className="relative rounded-[20px] bg-gradient-to-b from-muted/50 via-muted/20 to-transparent p-[1.5px] shadow-[0_32px_72px_-16px_rgba(0,0,0,0.28)] dark:shadow-[0_32px_72px_-16px_rgba(0,0,0,0.55)]">
              <div className="overflow-hidden rounded-[18px] bg-card ring-1 ring-border/50">
                <ZoomableImage
                  src={imageSrc}
                  alt="Portfolio page mockup showing holdings table, summary metrics, and privacy mode toggle"
                  frameClassName="rounded-[18px]"
                  imageClassName="block h-auto w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
