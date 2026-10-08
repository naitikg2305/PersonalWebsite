# Lambda container image for the site chatbot.
# Build:  podman build --platform linux/amd64 -t site-chatbot .
FROM public.ecr.aws/lambda/python:3.12

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the ONNX embedding model into the image so cold starts don't download 80 MB.
ENV ONNX_MODEL_DIR=/opt/onnx/all-MiniLM-L6-v2 \
    ANONYMIZED_TELEMETRY=False
RUN python -c "\
import pathlib; from chromadb.utils.embedding_functions import ONNXMiniLM_L6_V2; \
ONNXMiniLM_L6_V2.DOWNLOAD_PATH = pathlib.Path('/opt/onnx/all-MiniLM-L6-v2'); ONNXMiniLM_L6_V2()(['warmup'])"

COPY chatbot.py lambda_function.py ./
COPY chroma_db ./chroma_db

CMD ["lambda_function.handler"]
