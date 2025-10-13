import json
from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings
import aiofiles


class EditorConsumer(AsyncWebsocketConsumer):
    """
    Minimal broadcast-only collaborative text consumer.

    Protocol (JSON over WebSocket):
    - Client -> Server: { "type": "edit", "content": "...", "clientId": "uuid" }
    - Server -> Clients: { "type": "edit", "content": "...", "clientId": "uuid" }

    Notes:
    - Keeps latest_content in-process to initialize newly connected clients.
    - Uses Channels group to fan-out updates to all connected clients.
    """

    # In-memory, per-process latest content (OK for local dev)
    latest_content: str = ""

    async def connect(self):
        self.room_group_name = "editor"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # Send initial state to the just-connected client
        if EditorConsumer.latest_content is not None:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "edit",
                        "content": EditorConsumer.latest_content,
                        "clientId": None,
                    }
                )
            )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if text_data is None:
            return
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        if not isinstance(data, dict):
            return

        msg_type = data.get("type")

        if msg_type == "edit":
            content = data.get("content", "")
            client_id = data.get("clientId")

            # Update server memory with the latest content
            EditorConsumer.latest_content = content

            # Broadcast to everyone in the room (including sender)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "editor.message",  # maps to editor_message
                    "content": content,
                    "clientId": client_id,
                },
            )
            return

        if msg_type == "save":
            # Allow optional content override; default to latest known
            content = data.get("content", EditorConsumer.latest_content or "")
            file_path = settings.BASE_DIR / "test.txt"
            ok = True
            error = None
            try:
                async with aiofiles.open(file_path, mode="w", encoding="utf-8") as f:
                    await f.write(content)
            except Exception as exc:  # pragma: no cover - dev convenience
                ok = False
                error = str(exc)

            # Acknowledge save to the requesting client only
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "saved",
                        "ok": ok,
                        "path": str(file_path),
                        "error": error,
                    }
                )
            )
            return

        # Ignore unknown message types
        return

    async def editor_message(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "edit",
                    "content": event.get("content", ""),
                    "clientId": event.get("clientId"),
                }
            )
        )
