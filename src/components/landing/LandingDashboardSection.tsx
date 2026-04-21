import { DashboardScreenshot } from '@/components/DashboardScreenshot';
import { useTheme } from '@/hooks/useTheme';

export function LandingDashboardSection() {
  const { theme } = useTheme();
  const dashboardImageSrc =
    theme === 'light' ? '/landing/dashboard-etf-table-light.png' : '/landing/dashboard-etf-table.png';

  return (
    <section
      id="dashboard-overview"
      aria-labelledby="dashboard-overview-heading"
      className="border-t border-border/50 bg-background py-14 sm:py-18 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Dashboard
          </p>
          <h2
            id="dashboard-overview-heading"
            className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl"
          >
            See which ETFs are Healthy, Dying, or Dead at a glance
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Instantly evaluate every fund with Canary Status, True Income Yield, Death Clock, and
            ROC% so you can spot sustainable income opportunities and avoid hidden capital erosion.
          </p>
        </div>

        <DashboardScreenshot
          imageSrc={dashboardImageSrc}
          alt="YieldCanary main dashboard showing Canary Status, True Income Yield, Death Clock, and ROC%"
          enableParticles={false}
          enableFloating={true}
          enableScanLine={true}
          enableFeatureBadges={true}
          className="pt-8 sm:pt-10 lg:pt-12"
        />
      </div>
    </section>
  );
}
