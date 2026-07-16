FROM python:3.11-slim

WORKDIR /app

# 只装分词服务所需的最小依赖（去掉 supabase 等无关包，显著加速构建）
COPY requirements.service.txt .
RUN pip install --no-cache-dir -r requirements.service.txt

# 复制服务代码
COPY main.py .

# 预下载 PyThaiNLP 词典数据（构建期完成，避免容器首次请求时慢/超时）
# 数据写入 /root/.cache/pythainlp，已固化进镜像层，运行时无需再联网下载
RUN python -c "from pythainlp.tokenize import word_tokenize; word_tokenize('ทดสอบ ภาษาไทย การทำงาน ของนาฬิกา', engine='newmm')"

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
