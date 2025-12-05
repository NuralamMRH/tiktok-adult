#!/bin/sh
set -e
mkdir -p /app/shared
cd /app/python-scraper
# start simple HTTP server to serve shared status and logs
SCRAPER_PORT=${SCRAPER_PORT:-4000}
python3 -m http.server ${SCRAPER_PORT} --directory /app/shared &

if [ "${INITIAL_FULL_RUN}" = "1" ]; then
  echo "$(date -Iseconds) initial full run" >> /app/shared/scraper.log
  PAGE_LIMIT=${PAGE_LIMIT:-188} SAVE_DEBUG_HTML=${SAVE_DEBUG_HTML:-0} python3 main.py || true
  echo "$(date -Iseconds) initial full run complete" >> /app/shared/scraper.log
fi
INTERVAL=${DAILY_INTERVAL_SECONDS:-86400}
while true; do
  START_TS=$(date -Iseconds)
  echo "${START_TS} daily listing" >> /app/shared/scraper.log
  PAGE_LIMIT=${DAILY_PAGE_LIMIT:-1} LIST=1 SAVE_DEBUG_HTML=${SAVE_DEBUG_HTML:-0} python3 main.py >> /app/shared/scraper.log 2>&1 || true
  echo "$(date -Iseconds) daily details" >> /app/shared/scraper.log
  DETAILS=1 SAVE_DEBUG_HTML=${SAVE_DEBUG_HTML:-0} python3 main.py >> /app/shared/scraper.log 2>&1 || true
  END_TS=$(date -Iseconds)
  NEXT_TS=$(date -Iseconds -d "${INTERVAL} seconds" 2>/dev/null || echo "")
  printf '{"lastRun":"%s","nextRunInSeconds":%s,"port":%s}\n' "$END_TS" "$INTERVAL" "$SCRAPER_PORT" > /app/shared/scraper-status.json
  echo "${END_TS} run complete; next in ${INTERVAL}s" >> /app/shared/scraper.log
  sleep ${INTERVAL}
done
