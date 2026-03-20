#!/usr/bin/env python3
"""
Import full historical daily prices from Yahoo Finance into MarketPrice.

Usage:
    python3 apps/api/scripts/importFullHistory.py SPY
    python3 apps/api/scripts/importFullHistory.py QQQ
    python3 apps/api/scripts/importFullHistory.py IWM

Or from apps/api: python3 scripts/importFullHistory.py SPY

Requires DATABASE_URL in .env (repo root or apps/api).
Uses yfinance for historical data (~20 years).
Skips existing rows; safe to re-run.
"""
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

# Load .env before importing yfinance
def load_env():
    cwd = Path.cwd()
    for p in [cwd / ".env", cwd.parent / ".env", cwd.parent.parent / ".env"]:
        if p.exists():
            with open(p) as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, _, v = line.partition("=")
                        k, v = k.strip(), v.strip()
                        if k and k not in os.environ:
                            os.environ[k] = v
    if not os.environ.get("DATABASE_URL", "").strip():
        raise SystemExit("DATABASE_URL is not set. Add it to .env")

load_env()

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import yfinance as yf

DATASET_VERSION = "yfinance-full-v1"
BATCH_SIZE = 500


def log(msg: str):
    print(f"[{datetime.utcnow().isoformat()}Z] {msg}")


def parse_argv() -> str:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python3 importFullHistory.py SPY|QQQ|IWM|...")
    return sys.argv[1].strip().upper()


def fetch_yahoo(symbol: str) -> list[tuple]:
    """Fetch historical daily data from Yahoo Finance. Returns list of (date, open, high, low, close, volume)."""
    log(f"Fetching {symbol} from Yahoo Finance...")
    ticker = yf.Ticker(symbol)
    df = ticker.history(period="max", auto_adjust=True)
    if df.empty:
        raise SystemExit(f"No data returned for {symbol}")
    rows = []
    for dt, row in df.iterrows():
        if pd.isna(row["Open"]) or pd.isna(row["High"]) or pd.isna(row["Low"]) or pd.isna(row["Close"]):
            continue
        vol = row.get("Volume")
        volume = int(vol) if vol is not None and not pd.isna(vol) else None
        d = dt.date() if hasattr(dt, "date") else dt
        if hasattr(d, "isoformat"):
            ts = datetime.combine(d, datetime.min.time())
        else:
            ts = d
        rows.append((
            ts,
            float(row["Open"]),
            float(row["High"]),
            float(row["Low"]),
            float(row["Close"]),
            volume,
        ))
    rows.sort(key=lambda r: r[0])
    return rows


def main():
    symbol = parse_argv()
    conn = psycopg2.connect(os.environ["DATABASE_URL"])

    try:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT COUNT(*) FROM "MarketPrice" WHERE symbol = %s AND "datasetVersion" = %s',
                (symbol, DATASET_VERSION),
            )
            existing_before = cur.fetchone()[0]

        rows = fetch_yahoo(symbol)
        log(f"rows fetched: {len(rows)}")

        values = [
            (
                str(uuid.uuid4()),
                DATASET_VERSION,
                symbol,
                r[0],
                r[1],
                r[2],
                r[3],
                r[4],
                r[5],
            )
            for r in rows
        ]

        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO "MarketPrice" ("id", "datasetVersion", symbol, timestamp, open, high, low, close, volume)
                VALUES %s
                ON CONFLICT ("datasetVersion", symbol, timestamp) DO NOTHING
                """,
                values,
                page_size=BATCH_SIZE,
            )

        conn.commit()

        with conn.cursor() as cur:
            cur.execute(
                'SELECT COUNT(*) FROM "MarketPrice" WHERE symbol = %s AND "datasetVersion" = %s',
                (symbol, DATASET_VERSION),
            )
            total_after = cur.fetchone()[0]

        inserted = total_after - existing_before
        skipped = len(rows) - inserted

        log(f"symbol: {symbol}")
        log(f"rows fetched: {len(rows)}")
        log(f"rows inserted: {inserted}")
        log(f"rows skipped: {skipped}")
        log(f"total rows after import: {total_after}")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
