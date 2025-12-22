import React, { useCallback, useState, useEffect, useRef } from 'react';
import Particles from '@tsparticles/react';
import type { Engine } from '@tsparticles/engine';
import { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

let particlesInit: (() => Promise<void>) | null = null;

interface MarketingStatsProps {
  /** The dollar amount to display (e.g., 5000 for $5,000) */
  amount: number;
  /** Main headline text */
  headline?: string;
  /** Supporting description text */
  description?: string;
  /** Call-to-action button text */
  ctaText?: string;
  /** Call-to-action button link */
  ctaLink?: string;
  /** Custom CSS classes for container */
  className?: string;
  /** Enable/disable particle effects */
  enableParticles?: boolean;
  /** Enable/disable counter animation */
  enableCounter?: boolean;
}

/**
 * Hook for animated counter effect
 */
function useCounterAnimation(
  targetValue: number,
  duration: number = 2000,
  enabled: boolean = true
) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled || hasAnimated) return;

    const element = elementRef.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
            
            // Animate counter
            const startTime = Date.now();
            const startValue = 0;
            
            const animate = () => {
              const elapsed = Date.now() - startTime;
              const progress = Math.min(elapsed / duration, 1);
              
              // Easing function (ease-out)
              const easeOut = 1 - Math.pow(1 - progress, 3);
              const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOut);
              
              setCount(currentValue);
              
              if (progress < 1) {
                requestAnimationFrame(animate);
              } else {
                setCount(targetValue);
              }
            };
            
            requestAnimationFrame(animate);
          }
        });
      },
      { threshold: 0.3 }
    );

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [targetValue, duration, enabled, hasAnimated]);

  return { count, elementRef };
}

/**
 * Format currency with commas
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Holographic HUD Marketing Stats Component
 * Displays a futuristic stat card with particle effects and animations
 */
export function MarketingStats({
  amount,
  headline = "Users save $X on average by avoiding yield traps",
  description = "Join thousands of investors who use YieldCanary to identify dying funds before they erode their portfolio value.",
  ctaText = "Get Started Free",
  ctaLink = "/auth",
  className = "",
  enableParticles = true,
  enableCounter = true,
}: MarketingStatsProps) {
  const { count, elementRef } = useCounterAnimation(amount, 2000, enableCounter);
  const displayAmount = enableCounter ? count : amount;
  const formattedAmount = formatCurrency(displayAmount);

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
    <section className={`py-12 sm:py-20 px-4 sm:px-6 lg:px-8 marketing-stats-section ${className}`}>
      {/* Animated Background Layers */}
      <div className="marketing-stats-bg-layer-1 absolute inset-0 pointer-events-none"></div>
      <div className="marketing-stats-bg-layer-2 absolute inset-0 pointer-events-none"></div>
      <div className="marketing-stats-grid-pattern absolute inset-0 pointer-events-none"></div>
      
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="relative holographic-hud-card electric-card rounded-lg p-6 sm:p-8 lg:p-12 text-center overflow-hidden">
          {/* Enhanced Holographic Border Effect */}
          <div className="holographic-border absolute inset-0 rounded-lg pointer-events-none">
            <div className="holographic-scan-line"></div>
            {/* Corner brackets for tech feel */}
            <div className="marketing-stats-corner-brackets">
              <div className="marketing-corner marketing-corner-tl"></div>
              <div className="marketing-corner marketing-corner-tr"></div>
              <div className="marketing-corner marketing-corner-bl"></div>
              <div className="marketing-corner marketing-corner-br"></div>
            </div>
          </div>
          
          {/* Animated gradient overlay */}
          <div className="marketing-stats-gradient-overlay absolute inset-0 rounded-lg pointer-events-none"></div>

          {/* Particle Background */}
          {enableParticles && (
            <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
              <Particles
                id="marketing-stats-particles"
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
                        distance: 100,
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
                      speed: 0.5,
                      straight: false,
                    },
                    number: {
                      density: {
                        enable: true,
                      },
                      value: 30,
                    },
                    opacity: {
                      value: {
                        min: 0.2,
                        max: 0.6,
                      },
                      animation: {
                        enable: true,
                        speed: 1,
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
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 0,
                }}
              />
            </div>
          )}

          {/* Content */}
          <div className="relative z-10">
            {/* Headline */}
            <h2 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-foreground mb-4 sm:mb-6">
              {headline}
            </h2>

            {/* Stat Display */}
            <div 
              ref={elementRef}
              className="my-6 sm:my-8 relative inline-block"
            >
              <div className="holographic-number-container relative">
                {/* Glow effect behind number */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="holographic-number-glow text-4xl xs:text-5xl sm:text-6xl lg:text-7xl font-bold font-mono opacity-40 blur-xl text-primary">
                    {formattedAmount}
                  </div>
                </div>
                
                {/* Main number - white with green glow */}
                <div className="relative holographic-number text-4xl xs:text-5xl sm:text-6xl lg:text-7xl font-bold font-mono text-foreground holographic-number-glow-text">
                  {formattedAmount}
                </div>
              </div>
              
              <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wide mt-2 sm:mt-4">
                Average Savings Per User
              </p>
            </div>

            {/* Description */}
            <p className="text-sm xs:text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6 sm:mb-8">
              {description}
            </p>

            {/* CTA Button */}
            {ctaText && ctaLink && (
              <Link to={ctaLink}>
                <Button size="lg" variant="outline" className="electric-glow">
                  {ctaText}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

