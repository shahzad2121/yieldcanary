"""
Split Detection and Correction Module for YieldCanary
======================================================

This module detects stock splits by scanning for price discontinuities
and applies corrections to make historical prices comparable to current prices.

Used by bootstrap_database.py to fix issues like XYZY's 5:1 reverse split.
"""

from datetime import datetime
from typing import List, Dict, Optional


def detect_splits(prices: list, threshold: float = 1.5) -> list:
    """
    Detect stock splits by finding large price jumps between consecutive days.
    
    A stock split creates a discontinuity in price history:
    - Reverse split: Price suddenly jumps up (e.g., $13 → $65 for 5:1)
    - Forward split: Price suddenly drops down (e.g., $100 → $50 for 2:1)
    
    Args:
        prices: List of price data from FMP (sorted newest first)
        threshold: Minimum ratio to consider a split (1.5 = 50% change overnight)
    
    Returns:
        List of detected splits with dates and ratios
        
    Example:
        splits = detect_splits(prices)
        # Returns: [{'date': '2025-02-28', 'ratio': 5.05, 'type': 'reverse'}]
    """
    splits = []
    
    # Reverse list to go chronologically (oldest to newest)
    prices_chrono = list(reversed(prices))
    
    for i in range(1, len(prices_chrono)):
        prev_price = prices_chrono[i-1].get('close')
        curr_price = prices_chrono[i].get('close')
        
        if not prev_price or not curr_price or prev_price <= 0:
            continue
        
        ratio = curr_price / prev_price
        
        # Check for abnormal price changes (both reverse and forward splits)
        # Reverse split: ratio > threshold (e.g., 5.05 = 5-for-1 reverse split)
        # Forward split: ratio < 1/threshold (e.g., 0.5 = 2-for-1 forward split)
        if ratio > threshold or ratio < (1 / threshold):
            split = {
                'date': prices_chrono[i].get('date'),
                'prev_date': prices_chrono[i-1].get('date'),
                'prev_price': prev_price,
                'curr_price': curr_price,
                'ratio': ratio,
                'type': 'reverse' if ratio > 1 else 'forward'
            }
            splits.append(split)
    
    return splits


def adjust_prices_for_splits(prices: list, splits: list) -> list:
    """
    Apply split adjustments to historical prices.
    
    For each split, multiply all prices BEFORE the split by the split ratio.
    This makes historical prices comparable to current prices.
    
    Example:
        XYZY had a 5:1 reverse split on 2025-02-28
        
        Before adjustment:
        - 2025-02-05: $17.28 (pre-split)
        - 2025-02-28: $65.50 (post-split)
        - 2026-02-04: $28.49 (post-split)
        
        After adjustment:
        - 2025-02-05: $87.27 ($17.28 × 5.05) ← ADJUSTED
        - 2025-02-28: $65.50 (no change)
        - 2026-02-04: $28.49 (no change)
        
        Now 1Y return: ($28.49 / $87.27) - 1 = -67.35% ✓
    
    Args:
        prices: List of price data (sorted newest first)
        splits: List of splits from detect_splits()
    
    Returns:
        List of adjusted price data with same format as input
    """
    if not splits:
        return prices
    
    adjusted = []
    
    for price in prices:
        try:
            price_date = datetime.strptime(price['date'], '%Y-%m-%d')
        except:
            # If date parsing fails, keep original
            adjusted.append(price)
            continue
        
        adjustment_factor = 1.0
        
        # Apply all splits that occurred AFTER this price
        for split in splits:
            try:
                split_date = datetime.strptime(split['date'], '%Y-%m-%d')
            except:
                continue
            
            if split_date > price_date:
                # This price needs to be adjusted for this future split
                adjustment_factor *= split['ratio']
        
        # Create adjusted price entry (preserve all original fields)
        adjusted_price = {**price}  # Copy all fields
        
        # Adjust OHLC prices
        adjusted_price['close'] = price['close'] * adjustment_factor
        adjusted_price['open'] = price.get('open', price['close']) * adjustment_factor
        adjusted_price['high'] = price.get('high', price['close']) * adjustment_factor
        adjusted_price['low'] = price.get('low', price['close']) * adjustment_factor
        
        adjusted.append(adjusted_price)
    
    return adjusted