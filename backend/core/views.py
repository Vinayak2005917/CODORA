from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
from openai import OpenAI
from django.conf import settings
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import os

# Create your views here.

@csrf_exempt
@require_http_methods(["POST"])
def process_prompt(request):
    """
    Receives a prompt from the dashboard, sends it to the AI API,
    saves the response to test.txt, and broadcasts it to all doc_editor users.
    """
    try:
        data = json.loads(request.body)
        prompt = data.get('prompt', '').strip()
        
        if not prompt:
            return JsonResponse({'error': 'Prompt is required'}, status=400)
        
        # Initialize OpenAI client with OpenRouter
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key="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",
        )
        
        # Get AI response with Markdown formatting instruction
        completion = client.chat.completions.create(
            extra_headers={
                "HTTP-Referer": "https://codora.app",
                "X-Title": "CODORA",
            },
            model="google/gemma-3n-e4b-it:free",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful AI assistant. Format your responses using Markdown for better readability. Use headers (# ## ###), bold (**text**), italics (*text*), code blocks (```), lists, and other Markdown features as appropriate."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        
        ai_response = completion.choices[0].message.content
        
        # Save to test.txt
        test_file_path = settings.BASE_DIR / "test.txt"
        with open(test_file_path, 'w', encoding='utf-8') as f:
            f.write(ai_response)
        
        # Broadcast to all connected doc_editor users via WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "editor",
            {
                "type": "editor.message",
                "content": ai_response,
                "clientId": "AI_DASHBOARD"
            }
        )
        
        return JsonResponse({
            'success': True,
            'response': ai_response,
            'message': 'AI response saved and broadcast to doc_editor'
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
