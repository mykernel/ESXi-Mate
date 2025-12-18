FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# 使用国内镜像源加速 pip
ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ENV PIP_INDEX_URL=${PIP_INDEX_URL}

COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=60 -i ${PIP_INDEX_URL} --extra-index-url https://pypi.python.org/simple -r requirements.txt

COPY . .

EXPOSE 9601

CMD ["python", "main.py"]
