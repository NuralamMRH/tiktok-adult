FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium chromium-driver \
    fonts-liberation libnss3 libxss1 libasound2 libatk1.0-0 libatk-bridge2.0-0 libgbm1 libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*
COPY python-scraper/requirements.txt /app/python-scraper/requirements.txt
RUN python -m venv /app/venv && \
    /app/venv/bin/pip install --upgrade pip && \
    /app/venv/bin/pip install -r /app/python-scraper/requirements.txt
COPY python-scraper /app/python-scraper
COPY scripts /app/scripts
ENV PATH=/app/venv/bin:$PATH
ENV SAVE_DEBUG_HTML=0
ENV SHARED_DIR=/app/shared
CMD ["/bin/sh", "/app/python-scraper/entrypoint.sh"]

