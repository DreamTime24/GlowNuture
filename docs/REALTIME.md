# Realtime

The existing motion/live UI listens to GET /api/realtime/public over Server-Sent Events. It displays actual connected viewers in this API process, not fabricated global traffic. Stock/price invalidation reloads the approved catalog. A checkout page is not re-rendered by stock pushes so typed recipient details are preserved.

The protected admin SSE endpoint requires staff identity/permission/MFA. SSE is an operational hint; a fresh database query and transaction decides availability/status. Keep proxy buffering off and allow keep-alive comments.

The broker holds a bounded in-process replay buffer. It is not durable across restarts and not shared between API instances. Clients must resync the API after gaps. Add Redis/shared event delivery and shared limits before running multiple API processes.

SQL notifications and the leased worker are separate from the SSE broker. FCM/SMTP depend on configured providers and opt-in preferences; SQL/RTDB notifications are not order/stock sources of truth.
