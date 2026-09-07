FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Run the FastAPI server, listening on 0.0.0.0 and the port provided by Railway
CMD sh -c "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"
