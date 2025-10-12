from channels.generic.websocket import AsyncWebsocketConsumer
import json
import random

class TextConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Accept the connection
        await self.accept()
        await self.send_json({"message": "Connected to Django WebSocket!"})

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get("type")

        if msg_type == "edit":
            # When frontend sends an edit
            new_text = data.get("text", "")
            # Save/update backend file or DB here if you like
            with open("docs_test.txt", "w") as f:
                f.write(new_text)
            await self.send_json({"message": "Backend received your edit!"})

        elif msg_type == "request":
            # Frontend asks for current line
            with open("docs_test.txt", "r") as f:
                lines = f.readlines()
            await self.send_json({"text": random.choice(lines)})

    async def send_json(self, data):
        await self.send(text_data=json.dumps(data))

    async def disconnect(self, close_code):
        print("WebSocket disconnected")
