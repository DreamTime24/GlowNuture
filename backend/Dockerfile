FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /opt/glow/backend
COPY backend/requirements.txt ./requirements.txt
COPY backend/requirements.lock ./requirements.lock
RUN pip install --no-cache-dir -r requirements.lock
COPY backend/ ./
COPY frontend/ /opt/glow/frontend/
RUN useradd --system --uid 10001 glow && chown -R glow:glow /opt/glow
USER glow
EXPOSE 8000
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000","--workers","1"]
