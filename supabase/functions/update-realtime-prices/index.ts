import "jsr:@supabase/functions-js/edge-runtime.d.ts"

/**
 * Real-Time Price Update Edge Function
 * Updates latest prices for all ETFs using FMP quote endpoint.
 * Designed to run every 2 minutes during market hours via Supabase Cron.
 */

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
const fmpApiKey = Deno.env.get("FMP_API_KEY") ?? "";

// FMP API configuration
const FMP_BASE_URL = "https://financialmodelingprep.com/stable";
const REQUESTS_PER_MINUTE = 300;
const MIN_REQUEST_INTERVAL_MS = (60.0 / REQUESTS_PER_MINUTE) * 1000;
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60000;

// Rate limiting state
let lastRequestTime = 0;

/**
 * Wait for rate limit if needed
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    const sleepTime = MIN_REQUEST_INTERVAL_MS - elapsed;
    await new Promise(resolve => setTimeout(resolve, sleepTime));
  }
  lastRequestTime = Date.now();
}

/**
 * Make API request with rate limiting, error handling, and exponential backoff
 */
async function fmpRequest(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${FMP_BASE_URL}/${endpoint}`);
  params.apikey = fmpApiKey;
  
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await waitForRateLimit();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url.toString(), {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      // Handle rate limiting (429 Too Many Requests)
      if (response.status === 429) {
        const backoff = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attempt), MAX_BACKOFF_MS);
        console.log(`    Rate limited (429). Waiting ${backoff / 1000}s before retry ${attempt + 1}/${MAX_RETRIES}...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`    Request timeout. Retry ${attempt + 1}/${MAX_RETRIES}...`);
      } else if (attempt < MAX_RETRIES - 1) {
        const backoff = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attempt), MAX_BACKOFF_MS);
        console.log(`    Request error: ${error}. Waiting ${backoff / 1000}s before retry ${attempt + 1}/${MAX_RETRIES}...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      } else {
        throw error;
      }
    }
  }

  throw new Error(`Failed after ${MAX_RETRIES} retries`);
}

/**
 * Get real-time quote for a ticker using FMP quote endpoint
 */
async function getRealtimeQuote(ticker: string): Promise<{ price: number; date: string } | null> {
  try {
    const params = { symbol: ticker };
    const data = await fmpRequest("quote", params);
    
    // Quote endpoint returns array with one item
    if (data && Array.isArray(data) && data.length > 0) {
      const quote = data[0];
      const price = quote?.price;
      
      if (price && typeof price === 'number') {
        // Use current date for real-time quotes
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
        
        return {
          price: price,
          date: dateStr
        };
      }
    }
  } catch (error) {
    console.log(`    Error fetching quote for ${ticker}: ${error}`);
  }
  return null;
}

/**
 * Check if bootstrap is currently running
 * Auto-resets flag if it's been set for more than 45 minutes (stale flag)
 */
async function checkBootstrapFlag(): Promise<boolean> {
  try {
    // Fetch both value and updated_at timestamp
    const response = await fetch(`${supabaseUrl}/rest/v1/system_flags?key=eq.bootstrap_running&select=value,updated_at`, {
      headers: {
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
    });
    
    if (!response.ok) {
      // If table doesn't exist or error, assume not running (fail open)
      console.warn("Could not check bootstrap flag - assuming not running");
      return false;
    }
    
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      const flag = data[0];
      
      // If flag is not set, bootstrap is not running
      if (!flag.value) {
        return false;
      }
      
      // Check if flag is stale (older than 45 minutes)
      const updatedAt = new Date(flag.updated_at);
      const now = new Date();
      const ageMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
      const MAX_BOOTSTRAP_MINUTES = 60; // Auto-reset after 60 minutes
      
      if (ageMinutes > MAX_BOOTSTRAP_MINUTES) {
        // Flag is stale - auto-reset it
        console.warn(`⚠️  Bootstrap flag is stale (${ageMinutes.toFixed(1)} minutes old) - auto-resetting`);
        
        try {
          await fetch(`${supabaseUrl}/rest/v1/system_flags?key=eq.bootstrap_running`, {
            method: "PATCH",
            headers: {
              "apikey": serviceRoleKey,
              "Authorization": `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              value: false,
              updated_at: new Date().toISOString()
            }),
          });
          console.log("  ✓ Stale bootstrap flag auto-reset");
        } catch (resetError) {
          console.error(`  ✗ Failed to auto-reset stale flag: ${resetError}`);
        }
        
        // Return false since we've reset the flag
        return false;
      }
      
      // Flag is set and not stale - bootstrap is running
      return true;
    }
    return false;
  } catch (error) {
    // On error, assume not running (fail open - better to update than skip if uncertain)
    console.warn(`Error checking bootstrap flag: ${error} - assuming not running`);
    return false;
  }
}

/**
 * Get all tickers from the database
 */
async function getAllTickers(): Promise<string[]> {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/etfs?select=ticker`, {
      headers: {
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tickers: ${response.status}`);
    }

    const data = await response.json();
    if (Array.isArray(data)) {
      return data.map(row => row.ticker).filter(Boolean);
    }
    return [];
  } catch (error) {
    console.error(`Error fetching tickers: ${error}`);
    return [];
  }
}

/**
 * Update the latest price for an ETF in the database
 */
async function updateEtfPrice(ticker: string, price: number, priceDate: string): Promise<boolean> {
  try {
    // Round price to 2 decimal places
    const roundedPrice = Math.round(price * 100) / 100;
    
    const response = await fetch(`${supabaseUrl}/rest/v1/etfs?ticker=eq.${encodeURIComponent(ticker)}`, {
      method: "PATCH",
      headers: {
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        latest_adj_close: roundedPrice,
        latest_date: priceDate,
        updated_at: new Date().toISOString()
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update ${ticker}: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.log(`    Error updating ${ticker}: ${error}`);
    return false;
  }
}

/**
 * Check if US stock market is open (9:30 AM - 4:00 PM ET, Monday-Friday)
 * Returns true if market is open, false otherwise
 */
function isMarketOpen(): boolean {
  // Get current time and convert to ET timezone
  const now = new Date();
  
  // Format ET time to get components
  const etTimeStr = now.toLocaleString("en-US", { timeZone: "America/New_York" });
  const etDate = new Date(etTimeStr);
  
  // Note: Since we're creating a new Date from a localized string,
  // we need to get the day of week from UTC-adjusted ET time
  // Better approach: use Intl.DateTimeFormat to get weekday name
  const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long"
  });
  const weekday = weekdayFormatter.format(now);
  
  // Check if weekday (Monday-Friday)
  if (weekday === "Saturday" || weekday === "Sunday") {
    return false;
  }
  
  // Get hour and minute in ET timezone
  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false
  });
  const minuteFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    minute: "numeric"
  });
  
  const etHour = parseInt(hourFormatter.format(now), 10);
  const etMinute = parseInt(minuteFormatter.format(now), 10);
  
  // Market hours: 9:30 AM - 4:00 PM ET
  // Before 9:30 AM
  if (etHour < 9 || (etHour === 9 && etMinute < 30)) {
    return false;
  }
  
  // After 4:00 PM (16:00)
  if (etHour >= 16) {
    return false;
  }
  
  // Market is open (9:30 AM - 4:00 PM ET, Monday-Friday)
  return true;
}

/**
 * Main handler function
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // Validate environment variables
  if (!supabaseUrl || !serviceRoleKey || !fmpApiKey) {
    const missing = [];
    if (!supabaseUrl) missing.push("SUPABASE_URL");
    if (!serviceRoleKey) missing.push("SERVICE_ROLE_KEY");
    if (!fmpApiKey) missing.push("FMP_API_KEY");
    
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    return new Response(
      JSON.stringify({ error: `Missing environment variables: ${missing.join(", ")}` }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Check if market is open (skip update if market is closed)
  if (!isMarketOpen()) {
    const etDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const etTimeStr = etDate.toLocaleString("en-US", { 
      timeZone: "America/New_York",
      hour12: true,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric"
    });
    
    console.log(`⏸️  Market is closed (ET: ${etTimeStr}) - skipping update`);
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Market is closed",
        skipped: true,
        marketStatus: "closed",
        etTime: etTimeStr
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Check if bootstrap is running (skip update if bootstrap is in progress)
  const bootstrapRunning = await checkBootstrapFlag();
  if (bootstrapRunning) {
    console.log(`⏸️  Bootstrap is running - skipping price update to avoid conflicts`);
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Bootstrap in progress - update skipped",
        skipped: true,
        bootstrapRunning: true
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const startTime = new Date();
  console.log("\n" + "=".repeat(60));
  console.log("Real-Time Price Update (2-Minute Polling)");
  console.log("=".repeat(60));
  console.log(`Started at: ${startTime.toISOString()}\n`);

  try {
    // Get all tickers from database
    console.log("Fetching tickers from database...");
    const tickers = await getAllTickers();

    if (!tickers || tickers.length === 0) {
      console.log("  ✗ No tickers found in database");
      return new Response(
        JSON.stringify({ error: "No tickers found in database" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`  ✓ Found ${tickers.length} ETFs to update\n`);

    // Update prices
    let success = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];
      console.log(`[${i + 1}/${tickers.length}] Processing ${ticker}... `);

      try {
        // Get real-time quote from FMP
        const quoteData = await getRealtimeQuote(ticker);

        if (!quoteData || !quoteData.price) {
          console.log("✗ No quote data");
          skipped++;
          continue;
        }

        const { price, date } = quoteData;

        // Update in database
        if (await updateEtfPrice(ticker, price, date)) {
          console.log(`✓ Updated: $${price.toFixed(2)} (${date})`);
          success++;
        } else {
          console.log("✗ Update failed");
          failed++;
        }
      } catch (error) {
        console.log(`✗ Error: ${error}`);
        failed++;
      }
    }

    // Summary
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    console.log("\n" + "=".repeat(60));
    console.log("UPDATE COMPLETE");
    console.log("=".repeat(60));
    console.log(`Successfully updated: ${success}`);
    console.log(`Failed: ${failed}`);
    console.log(`Skipped (no data): ${skipped}`);
    console.log(`Total: ${tickers.length}`);
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log(`Finished at: ${endTime.toISOString()}\n`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          success,
          failed,
          skipped,
          total: tickers.length,
          duration: `${duration.toFixed(2)}s`,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});