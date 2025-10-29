import json
from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings
import aiofiles
from pathlib import Path
from asgiref.sync import sync_to_async
import uuid
from datetime import datetime


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
    # In-memory per-room chat history cache
    room_chat = {}
    # In-memory per-room chat history cache (dict: room -> list[message objects])
    room_chat = {}

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

        # Also tell the client who they are (so frontend knows current username/id)
        await self.send(text_data=json.dumps({
            'type': 'me',
            'user': self.user_info
        }))
        
        # Send chat history to the just-connected client
        try:
            history = self.room_chat.get(self.room)
            if history is None:
                # Try to load from projects/<room>/chat.json
                project_path = settings.BASE_DIR / 'projects' / self.room
                chat_path = project_path / 'chat.json'
                if chat_path.exists():
                    try:
                        async with aiofiles.open(chat_path, mode='r', encoding='utf-8') as f:
                            txt = await f.read()
                            history = json.loads(txt) if txt else []
                    except Exception as e:
                        print(f"Error loading chat history for {self.room}: {e}")
                        history = []
                else:
                    history = []
                self.room_chat[self.room] = history

            await self.send(text_data=json.dumps({ 'type': 'chat_history', 'messages': history }))
        except Exception as e:
            print('chat history send error', e)

        # Broadcast user joined to all other clients in room
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "user_joined_message",
                "user": self.user_info,
                "users": users_in_room
            }
        )
        # Debug connect
        print(f"[WS CONNECT] channel={self.channel_name} room={self.room} user={self.user_info.get('username')}")

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
        print(f"[WS DISCONNECT] channel={self.channel_name} room={self.room} code={close_code}")

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

        if msg_type == 'commit':
            # Save a version snapshot via project_store
            message = data.get('message', 'Snapshot')
            # Prefer server-side authenticated username when available
            if hasattr(self, 'user_info') and self.user_info:
                author = self.user_info.get('username')
            else:
                author = data.get('author', 'User')
            content = data.get('content', self.room_content_cache.get(self.room, ''))

            try:
                version = await sync_to_async(__import__('core.project_store', fromlist=['project_store']).project_store.save_version)(self.room, content, message, author)
            except Exception as e:
                version = None
                print('Commit error:', e)

            if version:
                # Acknowledge the committing client
                await self.send(text_data=json.dumps({'type': 'version_committed', 'version': version}))

                # Broadcast updated versions list to the room
                try:
                    versions = await sync_to_async(__import__('core.project_store', fromlist=['project_store']).project_store.list_versions)(self.room)
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'versions.list',
                            'versions': versions
                        }
                    )
                except Exception as e:
                    print('Error broadcasting versions list:', e)
            else:
                await self.send(text_data=json.dumps({'type': 'version_committed', 'error': 'Failed to save version'}))

            return

        if msg_type == 'delete_version':
            version_id = data.get('version_id')
            try:
                deleted = await sync_to_async(__import__('core.project_store', fromlist=['project_store']).project_store.delete_version)(self.room, version_id)
            except Exception as e:
                deleted = False
                print('delete_version error:', e)

            if deleted:
                # Broadcast the deletion to the whole room so every client can react immediately
                try:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'version.deleted',
                            'version_id': version_id,
                        }
                    )
                except Exception as e:
                    print('Error broadcasting version_deleted event to group:', e)

                # Also send confirmation to the requesting client
                await self.send(text_data=json.dumps({'type': 'version_deleted', 'version_id': version_id, 'ok': True}))

                # broadcast updated versions list
                try:
                    versions = await sync_to_async(__import__('core.project_store', fromlist=['project_store']).project_store.list_versions)(self.room)
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'versions.list',
                            'versions': versions
                        }
                    )
                except Exception as e:
                    print('Error broadcasting versions list after delete:', e)
            else:
                await self.send(text_data=json.dumps({'type': 'version_deleted', 'version_id': version_id, 'ok': False}))

            return

        if msg_type == 'list_versions':
            try:
                versions = await sync_to_async(__import__('core.project_store', fromlist=['project_store']).project_store.list_versions)(self.room)
                await self.send(text_data=json.dumps({'type': 'versions_list', 'versions': versions or []}))
            except Exception as e:
                print('list_versions error:', e)
                await self.send(text_data=json.dumps({'type': 'versions_list', 'versions': []}))
            return

        if msg_type == 'get_version':
            version_id = data.get('version_id')
            try:
                v = await sync_to_async(__import__('core.project_store', fromlist=['project_store']).project_store.get_version)(self.room, version_id)
                await self.send(text_data=json.dumps({'type': 'version_data', 'version': v}))
            except Exception as e:
                print('get_version error:', e)
                await self.send(text_data=json.dumps({'type': 'version_data', 'error': 'not found'}))
            return

        # Chat messages (broadcast to room)
        if msg_type == 'chat':
            # Prefer server-side authenticated username when available
            username = None
            if hasattr(self, 'user_info') and self.user_info:
                username = self.user_info.get('username')
            if not username:
                username = data.get('username', 'User')

            message = data.get('message') or data.get('text') or ''
            timestamp = data.get('timestamp') or datetime.utcnow().isoformat()

            print(f"[CHAT RECEIVE] room={self.room} channel={self.channel_name} username={username} message={message}")

            # Build canonical message object and append to in-memory history
            msg_obj = {
                'id': str(uuid.uuid4()),
                'username': username,
                'message': message,
                'timestamp': timestamp,
            }

            try:
                history = self.room_chat.get(self.room) or []
                history.append(msg_obj)
                self.room_chat[self.room] = history

                # Persist to projects/<room>/chat.json if project exists
                project_path = settings.BASE_DIR / 'projects' / self.room
                chat_path = project_path / 'chat.json'
                if project_path.exists():
                    try:
                        async with aiofiles.open(chat_path, mode='w', encoding='utf-8') as f:
                            await f.write(json.dumps(history, ensure_ascii=False, indent=2))
                    except Exception as e:
                        print(f"[CHAT PERSIST ERROR] room={self.room} err={e}")
            except Exception as e:
                print(f"[CHAT HISTORY ERROR] room={self.room} err={e}")

            # Broadcast chat message to everyone in room (include sender_channel so consumers can avoid echoing)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat.message',
                    'id': msg_obj['id'],
                    'username': username,
                    'message': message,
                    'timestamp': timestamp,
                    'sender_channel': self.channel_name,
                }
            )
            print(f"[CHAT BROADCAST] room={self.room} from={self.channel_name} id={msg_obj['id']}")
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

    async def chat_message(self, event):
        """Forward a chat.message event to the WebSocket client(s)."""
        # If the event included the sender's channel, skip sending back to that same channel
        sender = event.get('sender_channel')
        if sender and sender == self.channel_name:
            # don't echo back to the sender (the client shows optimistic UI)
            return

        await self.send(text_data=json.dumps({
            'type': 'chat',
            'username': event.get('username'),
            'message': event.get('message'),
            'timestamp': event.get('timestamp')
        }))

    async def versions_list(self, event):
        """Broadcast the versions list to clients."""
        await self.send(text_data=json.dumps({
            'type': 'versions_list',
            'versions': event.get('versions', [])
        }))

    async def version_deleted(self, event):
        """Forward a version_deleted group event to clients so they can update UI."""
        try:
            await self.send(text_data=json.dumps({
                'type': 'version_deleted',
                'version_id': event.get('version_id'),
                'ok': True
            }))
        except Exception as e:
            print('version_deleted handler error:', e)
