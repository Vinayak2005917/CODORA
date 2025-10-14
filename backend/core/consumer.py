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

        # Load content from test.txt if available, otherwise use in-memory content
        content_to_send = EditorConsumer.latest_content
        test_file_path = settings.BASE_DIR / "test.txt"
        
        try:
            if test_file_path.exists():
                async with aiofiles.open(test_file_path, mode="r", encoding="utf-8") as f:
                    file_content = await f.read()
                    if file_content:  # If file has content, use it
                        content_to_send = file_content
                        EditorConsumer.latest_content = file_content  # Update in-memory cache
        except Exception:
            pass  # Fall back to in-memory content

        # Send initial state to the just-connected client
        if content_to_send is not None:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "edit",
                        "content": content_to_send,
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
        content = event.get("content", "")
        # Update latest_content when broadcasting
        EditorConsumer.latest_content = content
        
        await self.send(
            text_data=json.dumps(
                {
                    "type": "edit",
                    "content": content,
                    "clientId": event.get("clientId"),
                }
            )
        )
