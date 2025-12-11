from dotenv import load_dotenv
import os
from supabase import create_client

load_dotenv('.env.local')
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

result = supabase.table('etfs').select('ticker, canary_health, roc_latest, inception_date, price_at_inception, latest_adj_close, dividends_since_inception').eq('canary_health', 'Unknown').execute()

print('Unknown ETFs - Why they are unknown:')
print('=' * 80)
print(f"{'Ticker':<8} {'ROC':<8} {'Inception':<12} {'Incep Price':<12} {'Latest':<10} {'Divs':<10} Reason")
print('-' * 80)

reasons = {'no_inception': 0, 'no_incep_price': 0, 'no_latest': 0, 'no_divs': 0, 'too_new': 0, 'other': 0}

for e in result.data:
    ticker = e['ticker']
    roc = e['roc_latest']
    inception = e['inception_date']
    incep_price = e['price_at_inception']
    latest = e['latest_adj_close']
    divs = e['dividends_since_inception']
    
    reason = ""
    if not inception:
        reason = "No inception date"
        reasons['no_inception'] += 1
    elif not incep_price:
        reason = "No inception price"
        reasons['no_incep_price'] += 1
    elif not latest:
        reason = "No latest price"
        reasons['no_latest'] += 1
    elif not divs or divs == 0:
        reason = "No dividends"
        reasons['no_divs'] += 1
    else:
        reason = "Other (check API)"
        reasons['other'] += 1
    
    print(f"{ticker:<8} {str(roc):<8} {str(inception):<12} {str(incep_price):<12} {str(latest):<10} {str(divs):<10} {reason}")

print('-' * 80)
print(f"\nTotal Unknown: {len(result.data)}")
print(f"  No inception date:  {reasons['no_inception']}")
print(f"  No inception price: {reasons['no_incep_price']}")
print(f"  No latest price:    {reasons['no_latest']}")
print(f"  No dividends:       {reasons['no_divs']}")
print(f"  Other:              {reasons['other']}")
