import { qdrantDataService } from './services/QdrantDataService';
import { logger } from './services/Logger';

export async function ensureQdrantRunning(retries = 5, delay = 2000): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      await qdrantDataService.initialize();
      const health = await qdrantDataService.healthCheck();
      if (health.status === 'healthy') {
        logger.info('Qdrant is healthy', health);
        return true;
      }
    } catch (error) {
      logger.warn(`Qdrant connection attempt ${i + 1}/${retries} failed`, { error });
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  logger.error('Failed to connect to Qdrant after multiple attempts');
  logger.info('Please ensure Qdrant is running:');
  logger.info('  docker run -p 6333:6333 -p 6334:6334 -v ./qdrant_storage:/qdrant/storage:z qdrant/qdrant');
  return false;
}

export async function checkOpenAIKey(): Promise<boolean> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    logger.warn('OpenAI API key not configured - embeddings will use random vectors');
    logger.info('To enable semantic search, set OPENAI_API_KEY in .env.local');
    return false;
  }
  return true;
}

export async function performStartupChecks(): Promise<boolean> {
  logger.info('Performing startup checks...');
  
  // Check Qdrant
  const qdrantOk = await ensureQdrantRunning();
  if (!qdrantOk) {
    return false;
  }
  
  // Check OpenAI (non-critical)
  await checkOpenAIKey();
  
  logger.info('Startup checks completed successfully');
  return true;
}
