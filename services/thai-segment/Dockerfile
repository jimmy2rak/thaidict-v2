FROM python:3.11-slim

WORKDIR /app

# 分词服务依赖
COPY services/thai-segment/requirements.service.txt ./requirements.service.txt
RUN pip install --no-cache-dir -r requirements.service.txt

# 回填脚本依赖（库内直接跑 segment_existing_data.py 需要）
RUN pip install --no-cache-dir supabase python-dotenv

# 复制整个仓库：API 代码 + 回填脚本 + 自定义词典，单一数据源
COPY . /app

WORKDIR /app/services/thai-segment

# 预下载 PyThaiNLP 词典数据（构建期完成，避免容器首次请求时慢/超时）
# 数据写入 /root/.cache/pythainlp，已固化进镜像层，运行时无需再联网下载
RUN python -c "from pythainlp.tokenize import word_tokenize; word_tokenize('ทดสอบ ภาษาไทย การทำงาน ของนาฬิกา', engine='newmm')"

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
