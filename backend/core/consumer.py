import json
from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings
import aiofiles
from pathlib import Path


class EditorConsumer(AsyncWebsocketConsumer):
    """
    Per-room collaborative text consumer with user presence tracking.

    Protocol (JSON over WebSocket):
    - Client -> Server: { "type": "edit", "content": "...", "clientId": "uuid" }
    - Server -> Clients: { "type": "edit", "content": "...", "clientId": "uuid" }
    
    - Client -> Server: { "type": "save", "content": "...", "clientId": "uuid" }
    - Server -> Client: { "type": "saved", "ok": true, "path": "..." }
    
    - Server -> Clients: { "type": "user_joined", "user": {...}, "users": [...] }
    - Server -> Clients: { "type": "user_left", "user": {...}, "users": [...] }
    - Server -> Clients: { "type": "users_list", "users": [...] }

    Notes:
    - Per-room content cache and WebSocket groups
    - Loads/saves content from projects/<room>/ directory
    - Tracks connected users per room
    """

    # In-memory per-room content cache (dict: room -> content)
    room_content_cache = {}
    
    # In-memory per-room users tracking (dict: room -> dict[channel_name -> user_info])
    room_users = {}

    async def connect(self):
        # Extract room from URL path (defaults to "default" for backward compatibility)
        self.room = self.scope['url_route']['kwargs'].get('room', 'default')
        self.room_group_name = f"editor_{self.room}"
        
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # Load content from project file or fallback to test.txt for default room
        content_to_send = self.room_content_cache.get(self.room, "")
        
        if self.room == 'default':
            # Backward compatibility: use test.txt
            test_file_path = settings.BASE_DIR / "test.txt"
            try:
                if test_file_path.exists():
                    async with aiofiles.open(test_file_path, mode="r", encoding="utf-8") as f:
                        file_content = await f.read()
                        if file_content:
                            content_to_send = file_content
                            self.room_content_cache[self.room] = file_content
            except Exception:
                pass
        else:
            # Load from project directory
            project_path = settings.BASE_DIR / "projects" / self.room
            if project_path.exists():
                # Try to load meta.json to get project type
                meta_path = project_path / "meta.json"
                content_filename = "content.md"  # default
                
                try:
                    if meta_path.exists():
                        async with aiofiles.open(meta_path, mode="r", encoding="utf-8") as f:
                            meta_content = await f.read()
                            meta = json.loads(meta_content)
                            project_type = meta.get('type', 'doc')
                            
                            # Determine content filename based on type
                            content_filename = {
                                'doc': 'content.md',
                                'code': 'main.txt',
                                'lesson': 'lesson.md'
                            }.get(project_type, 'content.md')
                    
                    # Load the content file
                    content_path = project_path / content_filename
                    if content_path.exists():
                        async with aiofiles.open(content_path, mode="r", encoding="utf-8") as f:
                            file_content = await f.read()
                            if file_content:
                                content_to_send = file_content
                                self.room_content_cache[self.room] = file_content
                except Exception as e:
                    print(f"Error loading project {self.room}: {e}")

        # Get user info from session
        user = self.scope.get('user')
        if user and user.is_authenticated:
            self.user_info = {
                'id': user.id,
                'username': user.username,
                'avatarColor': user.avatar_color
            }
        else:
            # Generate guest name for anonymous users
            import random
            guest_num = random.randint(1000, 9999)
            self.user_info = {
                'id': f'guest_{guest_num}',
                'username': f'Guest {guest_num}',
                'avatarColor': '#6b7280'
            }
        
        # Add user to room users tracking
        if self.room not in self.room_users:
            self.room_users[self.room] = {}
        self.room_users[self.room][self.channel_name] = self.user_info
        
        # Get all users in room
        users_in_room = list(self.room_users[self.room].values())

        # Send initial state to the just-connected client
        await self.send(
            text_data=json.dumps(
                {
                    "type": "edit",
                    "content": content_to_send,
                    "clientId": None,
                }
            )
        )
        
        # Send current users list to the just-connected client
        await self.send(
            text_data=json.dumps(
                {
                    "type": "users_list",
                    "users": users_in_room
                }
            )
        )
        
        # Broadcast user joined to all other clients in room
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "user_joined_message",
                "user": self.user_info,
                "users": users_in_room
            }
        )

    async def disconnect(self, close_code):
        # Remove user from room tracking
        if self.room in self.room_users and self.channel_name in self.room_users[self.room]:
            del self.room_users[self.room][self.channel_name]
            
            # Get updated users list
            users_in_room = list(self.room_users[self.room].values()) if self.room in self.room_users else []
            
            # Broadcast user left to remaining clients
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "user_left_message",
                    "user": self.user_info,
                    "users": users_in_room
                }
            )
        
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

            # Update room's content cache
            self.room_content_cache[self.room] = content

            # Broadcast to everyone in this room (including sender)
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
            content = data.get("content", self.room_content_cache.get(self.room, ""))
            ok = True
            error = None
            file_path = None
            
            try:
                if self.room == 'default':
                    # Backward compatibility: save to test.txt
                    file_path = settings.BASE_DIR / "test.txt"
                    async with aiofiles.open(file_path, mode="w", encoding="utf-8") as f:
                        await f.write(content)
                else:
                    # Save to project directory
                    project_path = settings.BASE_DIR / "projects" / self.room
                    
                    if not project_path.exists():
                        raise FileNotFoundError(f"Project {self.room} not found")
                    
                    # Load meta to get project type and determine filename
                    meta_path = project_path / "meta.json"
                    content_filename = "content.md"  # default
                    
                    if meta_path.exists():
                        async with aiofiles.open(meta_path, mode="r", encoding="utf-8") as f:
                            meta_content = await f.read()
                            meta = json.loads(meta_content)
                            project_type = meta.get('type', 'doc')
                            
                            content_filename = {
                                'doc': 'content.md',
                                'code': 'main.txt',
                                'lesson': 'lesson.md'
                            }.get(project_type, 'content.md')
                            
                            # Update timestamp
                            from datetime import datetime
                            meta['updated_at'] = datetime.utcnow().isoformat()
                            
                            # Update preview (simple extraction)
                            preview = content.replace('#', '').replace('*', '').replace('`', '')
                            lines = preview.split('\n')
                            preview_text = ' '.join(line.strip() for line in lines if line.strip())
                            if len(preview_text) > 300:
                                preview_text = preview_text[:300] + "..."
                            meta['preview'] = preview_text
                        
                        # Save updated meta
                        async with aiofiles.open(meta_path, mode="w", encoding="utf-8") as f:
                            await f.write(json.dumps(meta, indent=2, ensure_ascii=False))
                    
                    # Save content
                    file_path = project_path / content_filename
                    async with aiofiles.open(file_path, mode="w", encoding="utf-8") as f:
                        await f.write(content)
                        
            except Exception as exc:
                ok = False
                error = str(exc)

            # Acknowledge save to the requesting client only
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "saved",
                        "ok": ok,
                        "path": str(file_path) if file_path else None,
                        "error": error,
                    }
                )
            )
            return

        # Ignore unknown message types
        return

    async def editor_message(self, event):
        content = event.get("content", "")
        # Update room's content cache when broadcasting
        self.room_content_cache[self.room] = content
        
        await self.send(
            text_data=json.dumps(
                {
                    "type": "edit",
                    "content": content,
                    "clientId": event.get("clientId"),
                }
            )
        )
    
    async def user_joined_message(self, event):
        """Broadcast user joined event"""
        await self.send(
            text_data=json.dumps(
                {
                    "type": "user_joined",
                    "user": event.get("user"),
                    "users": event.get("users", [])
                }
            )
        )
    
    async def user_left_message(self, event):
        """Broadcast user left event"""
        await self.send(
            text_data=json.dumps(
                {
                    "type": "user_left",
                    "user": event.get("user"),
                    "users": event.get("users", [])
                }
            )
        )
