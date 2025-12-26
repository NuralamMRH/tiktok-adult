#!/bin/sh
set -e
mkdir -p /app/shared
cd /app/python-scraper
SCRAPER_PORT=${SCRAPER_PORT:-4000}
python3 /app/python-scraper/main.py server &

if [ "${INITIAL_FULL_RUN}" = "1" ]; then
  echo "$(date -Iseconds) initial full run" >> /app/shared/scraper.log
  cfg_file="/app/shared/scraper-config.json"
  if [ -f "$cfg_file" ]; then
    base=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("SCRAPER_BASE_URL",""))' "$cfg_file" 2>/dev/null || echo "")
    intervalCfg=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("DAILY_INTERVAL_SECONDS",""))' "$cfg_file" 2>/dev/null || echo "")
    [ -n "$base" ] && export SCRAPER_BASE_URL="$base"
    [ -n "$intervalCfg" ] && INTERVAL="$intervalCfg"
  fi
  PAGE_LIMIT=${PAGE_LIMIT:-188} SAVE_DEBUG_HTML=${SAVE_DEBUG_HTML:-0} python3 main.py || true
  echo "$(date -Iseconds) initial full run complete" >> /app/shared/scraper.log
fi
INTERVAL=${DAILY_INTERVAL_SECONDS:-86400}
while true; do
  START_TS=$(date -Iseconds)
  echo "${START_TS} daily scrape" >> /app/shared/scraper.log
  cfg_file="/app/shared/scraper-config.json"
  if [ -f "$cfg_file" ]; then
    base=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("SCRAPER_BASE_URL",""))' "$cfg_file" 2>/dev/null || echo "")
    intervalCfg=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("DAILY_INTERVAL_SECONDS",""))' "$cfg_file" 2>/dev/null || echo "")
    [ -n "$base" ] && export SCRAPER_BASE_URL="$base"
    [ -n "$intervalCfg" ] && INTERVAL="$intervalCfg"
  fi
  PAGE_LIMIT=${DAILY_PAGE_LIMIT:-1} SAVE_DEBUG_HTML=${SAVE_DEBUG_HTML:-0} python3 main.py >> /app/shared/scraper.log 2>&1 || true
  END_TS=$(date -Iseconds)
  NEXT_TS=$(date -Iseconds -d "${INTERVAL} seconds" 2>/dev/null || echo "")
  lastCount=0
  if [ -f "/app/python-scraper/listing-posts.json" ]; then
    lastCount=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("count",0))' "/app/python-scraper/listing-posts.json" 2>/dev/null || echo 0)
  fi
  printf '{"lastRun":"%s","nextRunInSeconds":%s,"port":%s,"lastListCount":%s}\n' "$END_TS" "$INTERVAL" "$SCRAPER_PORT" "$lastCount" > /app/shared/scraper-status.json
  echo "${END_TS} run complete; next in ${INTERVAL}s" >> /app/shared/scraper.log
  sleep ${INTERVAL}
done
