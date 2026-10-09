# Service de traduction des sous-titres (API Claude). Contexte de build : racine du dépôt.
FROM python:3.12-slim
WORKDIR /app
COPY translator/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY translator/src ./src
RUN useradd -m app
USER app
ENV PYTHONUNBUFFERED=1
EXPOSE 3000
CMD ["python", "src/main.py"]
