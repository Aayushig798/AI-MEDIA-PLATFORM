-- Run before `prisma db push`: semantic search stores OpenAI embeddings in a pgvector column.
CREATE EXTENSION IF NOT EXISTS vector;
