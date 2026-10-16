"""Real-time layer: in-process pub/sub fanned out to browsers over Server-Sent Events.

Two channels:
  public  -> stock/price changes and live presence (any visitor)
  admin   -> orders, status changes, low-stock alerts (admin session only)

Every message carries a monotonically increasing id. A browser that drops and
reconnects sends Last-Event-ID automatically, and the broker replays what it
missed from a bounded backlog. With more than one worker process, replace
`publish` / `_put` with Redis pub/sub; the SSE framing stays identical.
"""
import asyncio
import json
import time
from collections import deque


class Broker:
    def __init__(self) -> None:
        self.subs: dict[str, set[asyncio.Queue]] = {"public": set(), "admin": set()}
        self.backlog: dict[str, deque] = {"public": deque(maxlen=100), "admin": deque(maxlen=300)}
        self.seq = 0
        self.loop: asyncio.AbstractEventLoop | None = None

    def bind(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop

    def publish(self, channel: str, event: str, data: dict) -> None:
        """Safe to call from sync endpoints, which FastAPI runs in a worker thread."""
        self.seq += 1
        msg = {"id": self.seq, "event": event, "data": data, "ts": time.time()}
        self.backlog[channel].append(msg)
        if self.loop:
            for q in list(self.subs[channel]):
                self.loop.call_soon_threadsafe(self._put, q, msg)

    @staticmethod
    def _put(q: asyncio.Queue, msg: dict) -> None:
        try:
            q.put_nowait(msg)
        except asyncio.QueueFull:
            pass  # slow client: drop, it will resync through Last-Event-ID

    @staticmethod
    def frame(msg: dict) -> str:
        return f"id: {msg['id']}\nevent: {msg['event']}\ndata: {json.dumps(msg['data'], ensure_ascii=False)}\n\n"

    def viewers(self) -> int:
        return len(self.subs["public"])

    async def stream(self, channel: str, request, last_id: int | None = None):
        q: asyncio.Queue = asyncio.Queue(maxsize=256)
        self.subs[channel].add(q)
        if channel == "public":
            self.publish("public", "presence", {"viewers": self.viewers()})
        try:
            yield "retry: 3000\n\n"
            if last_id is not None:
                for msg in list(self.backlog[channel]):
                    if msg["id"] > last_id:
                        yield self.frame(msg)
            else:
                yield self.frame({"id": self.seq, "event": "hello", "data": {"viewers": self.viewers()}})
            while not await request.is_disconnected():
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=15)
                    yield self.frame(msg)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"  # keeps proxies from closing an idle stream
        finally:
            self.subs[channel].discard(q)
            if channel == "public":
                self.publish("public", "presence", {"viewers": self.viewers()})


broker = Broker()
