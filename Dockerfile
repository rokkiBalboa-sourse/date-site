FROM python:3.11-alpine

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV PORT=3000

# Copy all application files (HTML, CSS, JS, stickers .webm)
COPY . /app/

EXPOSE 3000

CMD ["python", "server.py"]
