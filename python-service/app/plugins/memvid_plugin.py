"""memvid_plugin.py

Provides a thin abstraction layer around the optional `memvid` package so that
other modules (e.g. `knowledge_graph.py`) can import the encoder / retriever
without duplicating fallback logic.
"""

from typing import List, Any

# Attempt to import the real memvid implementation; fall back to no-ops when the
# package is not installed so the rest of the application can still run.
try:
    from memvid import MemvidEncoder as _RealEncoder, MemvidRetriever as _RealRetriever  # type: ignore

    class MemvidEncoder(_RealEncoder):
        """Re-export the real encoder so callers don't need to know the details."""
        pass

    class MemvidRetriever(_RealRetriever):
        """Re-export the real retriever so callers don't need to know the details."""
        pass

    MEMVID_AVAILABLE = True

except ImportError:

    class MemvidEncoder:  # type: ignore
        """Stub encoder used when `memvid` is not installed."""

        def add_chunks(self, chunks: List[str]) -> None:  # noqa: D401
            # No-op in fallback mode
            return

        def build_video(self, video_path: str, index_path: str) -> None:  # noqa: D401
            # No-op in fallback mode
            return

    class MemvidRetriever:  # type: ignore
        """Stub retriever that always returns an empty list."""

        def __init__(self, video_path: str, index_path: str):  # noqa: D401
            # Store paths for parity with real retriever
            self.video_path = video_path
            self.index_path = index_path

        def search(self, query: str, limit: int = 10) -> List[Any]:  # noqa: D401
            return []

    MEMVID_AVAILABLE = False

__all__ = [
    "MEMVID_AVAILABLE",
    "MemvidEncoder",
    "MemvidRetriever",
] 