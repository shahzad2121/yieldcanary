

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hlwpasiewplmjvrtuuxf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsd3Bhc2lld3BsbWp2cnR1dXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NTM1NzUsImV4cCI6MjA4MDQyOTU3NX0.X7d2qD4B_niErA0l5Psaee_XxkRGUcIG8RE2lvG5_t8';
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
