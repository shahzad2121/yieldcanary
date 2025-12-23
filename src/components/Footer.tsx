import { Link } from 'react-router-dom';
import { Instagram, Youtube, Twitter } from 'lucide-react';

interface FooterProps {
  showDataDisclaimer?: boolean;
}

// Custom SVG icons for platforms not in lucide-react
const XIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

export function Footer({ showDataDisclaimer = false }: FooterProps) {
  return (
    <footer className="border-t border-border py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Legal Links */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mb-4 sm:mb-6">
          <Link
            to="/legal/terms"
            className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Terms of Service
          </Link>
          <span className="text-muted-foreground">•</span>
          <Link
            to="/legal/privacy"
            className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Privacy Policy
          </Link>
          <span className="text-muted-foreground">•</span>
          <Link
            to="/legal/refund"
            className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Refund Policy
          </Link>
          <span className="text-muted-foreground">•</span>
          <Link
            to="/legal/cookies"
            className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cookie Policy
          </Link>
          <span className="text-muted-foreground">•</span>
          <Link
            to="/legal/do-not-sell"
            className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Do Not Sell My Info
          </Link>
        </div>

        {/* Optional Data Disclaimer (for dashboard) */}
        {showDataDisclaimer && (
          <p className="text-center text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">
            Data updated daily. ROC data from 19a-1 filings.
          </p>
        )}

        {/* Bottom Row: Logo | Social Icons | Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          {/* Left: Logo */}
          <div className="flex items-center gap-2 order-1">
            <span className="text-lg xs:text-xl">🐤</span>
            <span className="text-sm xs:text-base font-bold text-foreground">YieldCanary</span>
          </div>

          {/* Middle: Social Media Icons */}
          <div className="flex items-center gap-3 sm:gap-4 order-2">
            <a
              href="https://x.com/yieldcanary"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow us on X (Twitter)"
              className="text-muted-foreground hover:text-primary transition-all duration-200 hover:scale-110 group"
            >
              <XIcon className="h-5 w-5 group-hover:social-icon-glow" />
            </a>
            <a
              href="https://www.youtube.com/@ryan_fish"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Subscribe to our YouTube channel"
              className="text-muted-foreground hover:text-primary transition-all duration-200 hover:scale-110 group"
            >
              <Youtube className="h-5 w-5 group-hover:social-icon-glow" />
            </a>
            <a
              href="https://www.tiktok.com/@yieldcanary"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow us on TikTok"
              className="text-muted-foreground hover:text-primary transition-all duration-200 hover:scale-110 group"
            >
              <TikTokIcon className="h-5 w-5 group-hover:social-icon-glow" />
            </a>
            <a
              href="https://www.instagram.com/yieldcanary"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow us on Instagram"
              className="text-muted-foreground hover:text-primary transition-all duration-200 hover:scale-110 group"
            >
              <Instagram className="h-5 w-5 group-hover:social-icon-glow" />
            </a>
          </div>

          {/* Right: Copyright */}
          <p className="text-xs xs:text-sm text-muted-foreground text-center sm:text-right order-3">
            © 2026 YieldCanary. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

