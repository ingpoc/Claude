"""
Configuration settings for the MCP Knowledge Graph service.
"""

import os
import logging
from pathlib import Path
from typing import Optional


class Settings:
    """Application settings with environment variable support."""
    
    # Server settings
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    DEBUG: bool = True
    
    # Storage settings
    STORAGE_DIR: str = "shared_knowledge"
    VIDEO_FILENAME: str = "knowledge_graph.mp4"
    INDEX_FILENAME: str = "knowledge_graph_index.json"
    METADATA_FILENAME: str = "metadata.json"
    
    # Memvid settings
    MEMVID_TIMEOUT: int = 30
    MEMVID_CHUNK_SIZE: int = 1024
    MEMVID_OVERLAP: int = 32
    
    # Search settings
    DEFAULT_SEARCH_LIMIT: int = 10
    MAX_SEARCH_LIMIT: int = 100
    MIN_RELEVANCE_SCORE: float = 0.5
    
    # Analytics settings
    TOP_CONTRIBUTORS_LIMIT: int = 5
    TOP_CONNECTED_ENTITIES_LIMIT: int = 5
    
    # AI settings
    AI_REQUEST_TIMEOUT: int = 30
    MAX_AI_TOKENS: int = 2048
    DEFAULT_AI_TEMPERATURE: float = 0.7
    
    def __init__(self):
        """Initialize settings from environment variables."""
        self.HOST = os.getenv("HOST", self.HOST)
        self.PORT = int(os.getenv("PORT", self.PORT))
        self.DEBUG = os.getenv("DEBUG", "true").lower() == "true"
        self.STORAGE_DIR = os.getenv("STORAGE_DIR", self.STORAGE_DIR)
        
    @property
    def storage_path(self) -> Path:
        """Get the storage directory path."""
        return Path(self.STORAGE_DIR)
    
    @property
    def video_path(self) -> Path:
        """Get the video file path."""
        return self.storage_path / self.VIDEO_FILENAME
    
    @property
    def index_path(self) -> Path:
        """Get the index file path."""
        return self.storage_path / self.INDEX_FILENAME
    
    @property
    def metadata_path(self) -> Path:
        """Get the metadata file path."""
        return self.storage_path / self.METADATA_FILENAME


# Global settings instance
settings = Settings()


def setup_logging():
    """Configure logging for the application."""
    log_level = logging.DEBUG if settings.DEBUG else logging.INFO
    
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
        ]
    )
    
    # Set specific loggers
    logging.getLogger("uvicorn").setLevel(log_level)
    logging.getLogger("fastapi").setLevel(log_level)


def get_memvid_availability() -> bool:
    """Check if memvid is available."""
    try:
        from memvid import MemvidEncoder, MemvidRetriever
        return True
    except ImportError:
        logging.warning("memvid not installed. Install with: pip install memvid")
        return False