# Advanced Plan Features - Structure & Implementation Plan

## Overview

This document outlines the structure, architecture, and implementation plan for Advanced plan features in YieldCanary. These features are **not yet implemented** but the structure is prepared for future development.

---

## Current Status

### ✅ Completed Infrastructure
- Stripe payment integration for Advanced plans (`advanced_monthly`, `advanced_yearly`)
- Database schema supports `subscription_tier = 'advanced'`
- Webhook handler updates Advanced subscription status
- UI displays Advanced plan in pricing and upgrade modals
- Teaser copy: "Lock in $19/month now – going to $49/month when released"

### ⚠️ Needs Implementation
- Plan differentiation logic (Dashboard recognizes Advanced tier)
- Feature flag system
- Individual Advanced features (see below)

---

## Advanced Plan Features

### 1. Weekly "Dead Canary Alert" Emails
**Status:** Not Implemented  
**Priority:** High  
**Complexity:** Medium

#### Description
Automated weekly email alerts sent to Advanced users when ETFs in their watchlist change to "Dead" canary status.

#### Technical Requirements
- **Backend Service:** Scheduled job (cron/Cloud Functions) that runs weekly
- **Email Service:** Integration with transactional email system (existing `sendTransactionalEmail.ts`)
- **Database Query:** 
  - Check watchlist_items for Advanced users
  - Compare current `canaryStatus` with previous week's status
  - Identify ETFs that changed to "Dead"
- **Email Template:** New template in `transactionalTemplates.ts`
- **User Preference:** Add `email_alerts_enabled` boolean to users table

#### Implementation Structure
```
supabase/
  functions/
    weekly-dead-canary-alerts/
      index.ts              # Main scheduled function
      checkStatusChanges.ts # Logic to detect status changes
      sendAlerts.ts         # Email sending logic

src/
  hooks/
    useEmailAlerts.ts      # Hook to manage alert preferences
  components/
    dashboard/
      EmailAlertsSettings.tsx  # UI for enabling/disabling alerts
```

#### Database Schema Changes
```sql
ALTER TABLE users 
ADD COLUMN email_alerts_enabled BOOLEAN DEFAULT true,
ADD COLUMN last_alert_sent_at TIMESTAMP;
```

---

### 2. Priority Email Support
**Status:** Not Implemented  
**Priority:** Medium  
**Complexity:** Low-Medium

#### Description
Advanced users get priority routing and faster response times for support requests.

#### Technical Requirements
- **Support System:** Integration with support platform (Zendesk, Intercom, or custom)
- **Email Routing:** Priority queue based on `subscription_tier`
- **UI Indicator:** Badge/indicator in support forms showing "Priority Support"
- **Response Time Tracking:** Optional - track response times

#### Implementation Structure
```
src/
  components/
    support/
      SupportForm.tsx           # Support request form
      PrioritySupportBadge.tsx  # Visual indicator
  lib/
    support.ts                  # Support API integration
```

#### Database Schema Changes
```sql
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY,
  user_email TEXT REFERENCES users(email),
  subscription_tier TEXT,
  priority INTEGER, -- Higher for Advanced users
  subject TEXT,
  message TEXT,
  status TEXT,
  created_at TIMESTAMP,
  resolved_at TIMESTAMP
);
```

---

### 3. Early Access to New ETFs
**Status:** Not Implemented  
**Priority:** Medium  
**Complexity:** Low

#### Description
Advanced users see new ETFs before they're available to Basic/Free users.

#### Technical Requirements
- **Database Flag:** Add `early_access` boolean to ETFs table
- **Filter Logic:** Show/hide ETFs based on user tier
- **UI Indicator:** Badge showing "Early Access" on new ETFs
- **Timeline:** Auto-release to all users after X days

#### Implementation Structure
```
src/
  hooks/
    useETFs.ts              # Modify to filter by early_access
  components/
    dashboard/
      EarlyAccessBadge.tsx  # Badge component
  lib/
    etfFilters.ts            # Filtering logic
```

#### Database Schema Changes
```sql
ALTER TABLE etfs 
ADD COLUMN early_access BOOLEAN DEFAULT false,
ADD COLUMN early_access_until DATE;
```

#### Filter Logic
```typescript
const filteredETFs = etfs.filter(etf => {
  if (etf.early_access && plan !== 'advanced') {
    return false; // Hide early access ETFs for non-Advanced users
  }
  return true;
});
```

---

### 4. CSV Export Functionality
**Status:** Partially Implemented  
**Priority:** High  
**Complexity:** Low

#### Description
Advanced users can export ETF data to CSV. Currently available to all paid users - needs restriction.

#### Current Implementation
- Location: `src/components/dashboard/ETFTable.tsx`
- Current check: `if (!isPaid)` - allows all paid users
- Needs: Change to `if (plan !== 'advanced')`

#### Required Changes
```typescript
// Current (line 316)
{isPaid && (
  <Button onClick={handleExportCSV}>Export CSV</Button>
)}

// Should be
{plan === 'advanced' && (
  <Button onClick={handleExportCSV}>Export CSV</Button>
)}
```

---

### 5. Portfolio Linking
**Status:** Not Implemented (Marked "Coming Soon")  
**Priority:** Low  
**Complexity:** High

#### Description
Advanced users can link their investment portfolio to track their actual holdings and get personalized insights.

#### Technical Requirements
- **Portfolio Storage:** Database table for user portfolios
- **Import Methods:** 
  - CSV upload
  - Manual entry
  - Broker API integration (future)
- **Portfolio Dashboard:** View showing user's ETFs with YieldCanary metrics
- **Integration:** Match user holdings with ETF data

#### Implementation Structure
```
supabase/
  migrations/
    create_portfolios_table.sql
    create_portfolio_items_table.sql

src/
  pages/
    PortfolioPage.tsx          # Main portfolio view
  components/
    portfolio/
      PortfolioImport.tsx      # CSV upload/manual entry
      PortfolioTable.tsx       # Display user holdings
      PortfolioInsights.tsx    # Personalized insights
  hooks/
    usePortfolio.ts            # Portfolio data management
  lib/
    portfolioImport.ts         # CSV parsing logic
```

#### Database Schema
```sql
CREATE TABLE portfolios (
  id UUID PRIMARY KEY,
  user_email TEXT REFERENCES users(email),
  name TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE portfolio_items (
  id UUID PRIMARY KEY,
  portfolio_id UUID REFERENCES portfolios(id),
  ticker TEXT REFERENCES etfs(ticker),
  shares DECIMAL,
  average_cost DECIMAL,
  notes TEXT,
  created_at TIMESTAMP
);
```

---

### 6. Monthly YieldCanary Newsletter
**Status:** Not Implemented  
**Priority:** Low  
**Complexity:** Medium

#### Description
Monthly email newsletter with market insights, ETF updates, and educational content.

#### Technical Requirements
- **Content Management:** System to create/manage newsletter content
- **Email Automation:** Monthly scheduled send
- **Template:** Newsletter email template
- **User Preference:** Opt-in/opt-out setting

#### Implementation Structure
```
supabase/
  functions/
    monthly-newsletter/
      index.ts              # Scheduled monthly job
      generateContent.ts    # Content generation logic
      sendNewsletter.ts     # Email sending

src/
  components/
    dashboard/
      NewsletterSettings.tsx  # Opt-in/opt-out UI
```

#### Database Schema Changes
```sql
ALTER TABLE users 
ADD COLUMN newsletter_enabled BOOLEAN DEFAULT true;
```

---

## Feature Flag System

### Structure
Create a centralized feature flag system to enable/disable Advanced features.

#### File: `src/lib/featureFlags.ts`
```typescript
export const FEATURE_FLAGS = {
  ADVANCED_EMAIL_ALERTS: false,        // Coming soon
  ADVANCED_PRIORITY_SUPPORT: false,     // Coming soon
  ADVANCED_EARLY_ACCESS_ETFS: false,   // Coming soon
  ADVANCED_CSV_EXPORT: true,            // Implemented, needs restriction
  ADVANCED_PORTFOLIO_LINKING: false,    // Coming soon
  ADVANCED_NEWSLETTER: false,           // Coming soon
} as const;

export function isFeatureEnabled(feature: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[feature];
}

export function canAccessAdvancedFeature(
  userTier: string | null,
  feature: keyof typeof FEATURE_FLAGS
): boolean {
  if (userTier !== 'advanced') return false;
  return isFeatureEnabled(feature);
}
```

---

## Plan Differentiation System

### Current Issue
Dashboard and WatchlistPage only distinguish `'free'` vs `'basic'`, not `'advanced'`.

### Required Changes

#### 1. Update Plan Type
**Files:** `Dashboard.tsx`, `WatchlistPage.tsx`

```typescript
// Current
type Plan = 'free' | 'basic';

// Should be
type Plan = 'free' | 'basic' | 'advanced';
```

#### 2. Update Plan Logic
```typescript
// Current
const plan: Plan = subscriptionTier === 'basic' ? 'basic' : 'free';

// Should be
const plan: Plan = 
  subscriptionTier === 'advanced' ? 'advanced' :
  subscriptionTier === 'basic' ? 'basic' : 
  'free';
```

#### 3. Create Helper Hook
**File:** `src/hooks/usePlanFeatures.ts`
```typescript
import { useUserSubscription } from './useUserSubscription';

export function usePlanFeatures() {
  const { user } = useUserSubscription();
  const tier = user?.subscription_tier ?? 'free';
  
  return {
    isFree: tier === 'free',
    isBasic: tier === 'basic',
    isAdvanced: tier === 'advanced',
    isPaid: tier === 'basic' || tier === 'advanced',
    tier,
  };
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Immediate)
- [x] Stripe payment integration
- [x] Database schema for subscription tiers
- [ ] **Fix plan differentiation** (Dashboard recognizes Advanced)
- [ ] **Restrict CSV export to Advanced only**
- [ ] Create feature flag system
- [ ] Create `usePlanFeatures()` hook

### Phase 2: Quick Wins (1-2 weeks)
- [ ] Early Access ETFs (low complexity)
- [ ] Priority Support UI indicators
- [ ] Feature flag integration

### Phase 3: Email Features (2-4 weeks)
- [ ] Weekly Dead Canary Alerts
- [ ] Email alert preferences UI
- [ ] Monthly Newsletter (if needed)

### Phase 4: Major Features (4-8 weeks)
- [ ] Portfolio Linking
- [ ] Portfolio Dashboard
- [ ] Portfolio Insights

---

## Code Structure Recommendations

### Directory Structure
```
src/
  components/
    advanced/                    # Advanced-only components
      EarlyAccessBadge.tsx
      PortfolioLinking.tsx
      EmailAlertsSettings.tsx
    dashboard/
      ETFTable.tsx              # Update CSV export check
      Dashboard.tsx              # Update plan type
  hooks/
    usePlanFeatures.ts          # NEW - Plan feature helpers
    useEmailAlerts.ts           # NEW - Email alert management
    usePortfolio.ts             # NEW - Portfolio management
  lib/
    featureFlags.ts             # NEW - Feature flag system
    etfFilters.ts               # NEW - ETF filtering logic
    portfolioImport.ts          # NEW - Portfolio import
  pages/
    PortfolioPage.tsx           # NEW - Portfolio dashboard
```

### Database Migrations Needed
```sql
-- Add user preferences
ALTER TABLE users 
ADD COLUMN email_alerts_enabled BOOLEAN DEFAULT true,
ADD COLUMN newsletter_enabled BOOLEAN DEFAULT true,
ADD COLUMN last_alert_sent_at TIMESTAMP;

-- Add early access to ETFs
ALTER TABLE etfs 
ADD COLUMN early_access BOOLEAN DEFAULT false,
ADD COLUMN early_access_until DATE;

-- Portfolio tables (if implementing)
CREATE TABLE portfolios (...);
CREATE TABLE portfolio_items (...);
```

---

## Testing Strategy

### Unit Tests
- Feature flag system
- Plan differentiation logic
- ETF filtering (early access)

### Integration Tests
- CSV export (Advanced only)
- Email alert triggers
- Portfolio import/export

### E2E Tests
- Advanced user flow
- Feature access restrictions
- Email delivery

---

## Environment Variables

Add to `.env.local`:
```env
# Feature Flags (optional - can use code-based flags)
VITE_ENABLE_ADVANCED_ALERTS=false
VITE_ENABLE_PORTFOLIO_LINKING=false

# Email Service (for alerts/newsletter)
VITE_EMAIL_SERVICE_API_KEY=...
```

---

## Notes

1.  **Plan Differentiation**: Critical fix needed before Advanced features can work
2. **Feature Flags**: Use code-based flags initially, can move to env vars later
3. **Email Features**: Require backend automation (Supabase Functions or external service)
4. **Portfolio Linking**: Major feature, should be separate project phase

---

**Last Updated:** 2025-12-25  
**Status:** Planning Phase - Structure Finalized

