import React, { useCallback, useState } from 'react';
import Particles from '@tsparticles/react';
import type { Engine } from '@tsparticles/engine';
import { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import { TrendingDown, Clock, AlertTriangle, Shield } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

let particlesInit: (() => Promise<void>) | null = null;

interface FeatureBadge {
  icon: React.ReactNode;
  title: string;
  description: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  columnTarget?: string; // For connection line targeting
}

interface DashboardScreenshotProps {
  /** Path to the dashboard screenshot image */
  imageSrc?: string;
  /** Alt text for the image */
  alt?: string;
  /** Custom CSS classes for container */
  className?: string;
  /** Enable/disable particle effects */
  enableParticles?: boolean;
  /** Enable/disable floating animation */
  enableFloating?: boolean;
  /** Enable/disable scan line animation */
  enableScanLine?: boolean;
  /** Enable/disable feature badges */
  enableFeatureBadges?: boolean;
  /** Custom image width (default: responsive) */
  maxWidth?: string;
}

/**
 * Holographic Floating Dashboard Screenshot Component
 * Displays a dashboard screenshot with 3D pop-out effect, holographic frame, and particle effects
 */
export function DashboardScreenshot({
  imageSrc,
  alt = 'YieldCanary Dashboard Preview',
  className = '',
  enableParticles = true,
  enableFloating = true,
  enableScanLine = true,
  enableFeatureBadges = true,
  maxWidth = '100%',
}: DashboardScreenshotProps) {
  const { theme } = useTheme();
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);
  
  // Use theme-based image if imageSrc is not provided
  const finalImageSrc = imageSrc || (theme === 'light' ? '/dashboard-light-3.png' : '/dashboard-dark-3.png');

  // Feature badges matching existing homepage content
  const featureBadges: FeatureBadge[] = [
    {
      icon: <TrendingDown className="h-5 w-5" />,
      title: 'True Income Yield',
      description: 'The real yield after stripping out return-of-capital.',
      position: 'top-left',
      columnTarget: 'true-income',
    },
    {
      icon: <Clock className="h-5 w-5" />,
      title: 'Death Clock',
      description: 'Exact years until 50% NAV erosion.',
      position: 'top-right',
      columnTarget: 'death-clock',
    },
    {
      icon: <AlertTriangle className="h-5 w-5" />,
      title: 'Canary Status',
      description: 'Healthy / Dying / Dead status at a glance',
      position: 'bottom-left',
      columnTarget: 'canary-status',
    },
    {
      icon: <Shield className="h-5 w-5" />,
      title: 'Live ROC %',
      description: 'Estimated weekly from recent NAV erosion & distribution trends.',
      position: 'bottom-right',
      columnTarget: 'roc-percent',
    },
  ];
  const handleParticlesInit = useCallback(async (engine: Engine) => {
    if (particlesInit) {
      await particlesInit();
      return;
    }
    
    await initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    });
    particlesInit = async () => {
      await loadSlim(engine);
    };
  }, []);

  return (
    <section className={`py-12 sm:py-20 px-4 sm:px-6 lg:px-8 overflow-visible ${className}`}>
      <div className="max-w-6xl mx-auto overflow-visible">
        <div className="relative holographic-screenshot-container">
          {/* Particle Background - Orbiting around image */}
          {enableParticles && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg">
              <Particles
                id="dashboard-screenshot-particles"
                init={handleParticlesInit}
                options={{
                  background: {
                    color: {
                      value: 'transparent',
                    },
                  },
                  fpsLimit: 60,
                  interactivity: {
                    events: {
                      onHover: {
                        enable: true,
                        mode: 'repulse',
                      },
                      resize: {
                        enable: true,
                      },
                    },
                    modes: {
                      repulse: {
                        distance: 80,
                        duration: 0.4,
                      },
                    },
                  },
                  particles: {
                    color: {
                      value: '#1a9c6e',
                    },
                    links: {
                      enable: false,
                    },
                    move: {
                      direction: 'none',
                      enable: true,
                      outModes: {
                        default: 'bounce',
                      },
                      random: true,
                      speed: 0.3,
                      straight: false,
                    },
                    number: {
                      density: {
                        enable: true,
                        area: 600,
                      },
                      value: 25,
                    },
                    opacity: {
                      value: {
                        min: 0.2,
                        max: 0.5,
                      },
                      animation: {
                        enable: true,
                        speed: 0.5,
                        sync: false,
                      },
                    },
                    shape: {
                      type: 'circle',
                    },
                    size: {
                      value: {
                        min: 1,
                        max: 2,
                      },
                    },
                  },
                  detectRetina: true,
                }}
                className="absolute inset-0"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 1,
                }}
              />
            </div>
          )}

          {/* Holographic Frame Container */}
          <div 
            className={`relative holographic-frame-group ${enableFloating ? 'holographic-floating' : ''}`}
            style={{ maxWidth }}
          >
            {/* Holographic Border with Scan Line */}
            <div className="holographic-border-frame relative rounded-lg overflow-hidden">
              {enableScanLine && (
                <div className="holographic-scan-line-dashboard absolute inset-0 pointer-events-none"></div>
              )}
              
              {/* Corner Brackets */}
              <div className="holographic-corner-brackets">
                <div className="corner-bracket corner-top-left"></div>
                <div className="corner-bracket corner-top-right"></div>
                <div className="corner-bracket corner-bottom-left"></div>
                <div className="corner-bracket corner-bottom-right"></div>
              </div>

              {/* Dashboard Screenshot Image */}
              <div className="holographic-image-wrapper relative">
                <img
                  src={finalImageSrc}
                  alt={alt}
                  className="holographic-screenshot-image w-full h-auto rounded-lg"
                  loading="lazy"
                />
                
                {/* Overlay glow effect */}
                <div className="holographic-image-overlay absolute inset-0 rounded-lg pointer-events-none"></div>
              </div>
            </div>

            {/* Depth Shadow Layers */}
            <div className="holographic-shadow-layer-1 absolute inset-0 rounded-lg -z-10"></div>
            <div className="holographic-shadow-layer-2 absolute inset-0 rounded-lg -z-20"></div>
          </div>

          {/* Feature Badges with Connection Lines */}
          {enableFeatureBadges && (
            <div className="feature-badges-wrapper">
              {featureBadges.map((badge, index) => (
                <div
                  key={badge.position}
                  className={`feature-badge feature-badge-${badge.position}`}
                  onMouseEnter={() => setHoveredBadge(badge.columnTarget || null)}
                  onMouseLeave={() => setHoveredBadge(null)}
                  style={{
                    animationDelay: `${index * 0.15}s`,
                  }}
                >
                  {/* Connection Line */}
                  <div 
                    className={`feature-connection-line feature-line-${badge.position} ${hoveredBadge === badge.columnTarget ? 'line-active' : ''}`}
                  >
                    <div className="connection-line-beam"></div>
                  </div>

                  {/* Badge Card */}
                  <div className="feature-badge-card holographic-badge">
                    <div className="feature-badge-icon">
                      {badge.icon}
                    </div>
                    <div className="feature-badge-content">
                      <h3 className="feature-badge-title">{badge.title}</h3>
                      <p className="feature-badge-description">{badge.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

