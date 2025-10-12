from django.shortcuts import render
from django.http import JsonResponse
import random

#read from the docs_test.txt file
with open("docs_test.txt", "r") as file:
    lines = file.readlines()

def text_view(request):
    return JsonResponse({"text": lines})