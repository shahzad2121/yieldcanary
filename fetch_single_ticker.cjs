// Usage: node fetch_single_ticker.cjs TICKER
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function printSingleTickerValues(ticker) {
  const { data, error } = await supabase
    .from('etfs')
    .select('*')
    .eq('ticker', ticker)
    .single();
  if (error) {
    console.error('Error fetching ETF:', error);
    process.exit(1);
  }
  console.log('ETF values for', ticker, data);
}

const ticker = process.argv[2] || 'TSLY';
printSingleTickerValues(ticker).then(() => process.exit(0));
