#!/usr/bin/env python3
"""
metrics_service.py – thin loop around refresh_metrics.main()

• Every 6 h:
    – import (or reload) refresh_metrics
    – call refresh_metrics.main()
    – sleep
"""

import importlib
import time
from datetime import datetime

# ----- one-time import (because refresh_metrics has no global state) -----
import refresh_metrics as refresh   # works once you add __init__.py

HOURS = 3
INTERVAL = HOURS * 3600

def run_cycle():
    ts = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    print(f"[service {ts}] starting refresh run")
    try:
        refresh.main()
    except Exception as e:
        print(f"[service] run failed: {e}")
    print(f"[service] sleeping {HOURS} h\n")

if __name__ == "__main__":
    while True:
        run_cycle()
        time.sleep(INTERVAL)
