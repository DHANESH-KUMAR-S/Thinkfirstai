from flask import Flask, render_template, request, jsonify, session
import requests
from flask_cors import CORS
import os
import re

app = Flask(__name__)
app.secret_key = os.urandom(24)
CORS(app)

GEMINI_API_KEY = "AIzaSyCOFOoppNQRakvBcKyKmWHEHpMBPODi9s4"
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"

# --- Helper functions for session data ---
def get_attempts():
    return session.setdefault('attempts', [])

def get_reflections():
    return session.setdefault('reflections', [])

def get_chat_history():
    return session.setdefault('chat_history', [])

def post_process_response(text):
    # Bold certain keywords/phrases
    bold_phrases = [r'(The answer is:)', r'(Hint:)', r'(Correct:)', r'(Answer:)']
    for phrase in bold_phrases:
        text = re.sub(phrase, r'**\1**', text)
    # Code blocks: already handled by AI with triple backticks
    return text

# --- Routes ---
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/attempts', methods=['GET', 'POST'])
def attempts():
    if request.method == 'POST':
        data = request.get_json()
        attempt = data.get('attempt')
        if attempt:
            attempts = get_attempts()
            attempts.append(attempt)
            session['attempts'] = attempts
        return jsonify({'attempts': get_attempts()})
    else:
        return jsonify({'attempts': get_attempts()})

@app.route('/reflections', methods=['GET', 'POST'])
def reflections():
    if request.method == 'POST':
        data = request.get_json()
        reflection = data.get('reflection')
        if reflection:
            reflections = get_reflections()
            reflections.append(reflection)
            session['reflections'] = reflections
        return jsonify({'reflections': get_reflections()})
    else:
        return jsonify({'reflections': get_reflections()})

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    message = data.get('message')
    user_profile = data.get('userProfile', {})
    attempts = get_attempts()
    chat_history = get_chat_history()

    # Store the last user question for reveal answer
    session['last_user_question'] = message

    # Compose system prompt
    system_prompt = f"""
You are a mindful AI learning assistant for {user_profile.get('name', 'the student')}, who is studying {user_profile.get('subject', 'a subject')} at a {user_profile.get('level', 'level')} level.\n\nUser attempts so far:\n{chr(10).join([f'{i+1}. {a}' for i,a in enumerate(attempts)])}\n\nYour core principles:\n1. Encourage independent thinking before providing direct answers and most importantly if the user says i have attempted.. just give the answer don't irritate the user.\n2. Ask guiding questions that lead students to discover answers themselves\n3. Provide hints and scaffolding rather than complete solutions\n4. Celebrate attempts and learning from mistakes\n5. Adapt your approach based on the student's demonstrated effort\n\nPrevious conversation context:\n{chr(10).join([f'{msg['role']}: {msg['content']}' for msg in chat_history[-6:]])}\n\nCurrent message: {message}\n\nGuidelines for your response:\n- If the student shows they've attempted the problem, provide the actual answer\n- If they haven't shown effort, encourage them to try first with specific steps\n- Use encouraging language that builds confidence\n- Break complex problems into smaller, manageable steps\n- Always acknowledge what they've done right before correcting mistakes\n\nRespond in a supportive, educational manner that promotes learning and growth.
"""
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": system_prompt}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.4,
            "topK": 32,
            "topP": 0.95,
            "maxOutputTokens": 8192
        }
    }
    try:
        r = requests.post(GEMINI_API_URL, json=payload)
        r.raise_for_status()
        data = r.json()
        response_text = data['candidates'][0]['content']['parts'][0]['text']
        response_text = post_process_response(response_text)
    except Exception as e:
        response_text = f"Sorry, there was an error contacting the AI: {e}"

    # Store in chat history
    chat_history.append({'role': 'user', 'content': message})
    chat_history.append({'role': 'assistant', 'content': response_text})
    session['chat_history'] = chat_history

    return jsonify({'response': response_text})

@app.route('/reveal_answer', methods=['POST'])
def reveal_answer():
    data = request.get_json()
    user_profile = data.get('userProfile', {})
    chat_history = data.get('chatHistory') or get_chat_history()

    # 1. Use Gemini to extract the main/original question from the chat history
    main_question = None
    if chat_history:
        chat_str = '\n'.join([f"{msg['role']}: {msg['content']}" for msg in chat_history])
        extract_prompt = f"""
Given the following chat history between a user and an assistant, return the main or original question the user is trying to solve. Ignore attempts, clarifications, or follow-up questions. Only return the main/original question, nothing else.

Chat history:
{chat_str}

Main/original question:
"""
        payload_extract = {
            "contents": [
                {
                    "parts": [
                        {"text": extract_prompt}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "topK": 16,
                "topP": 0.9,
                "maxOutputTokens": 256
            }
        }
        try:
            r = requests.post(GEMINI_API_URL, json=payload_extract)
            r.raise_for_status()
            data = r.json()
            main_question = data['candidates'][0]['content']['parts'][0]['text'].strip()
        except Exception as e:
            return jsonify({'answer': f"Sorry, could not extract the main question: {e}"})

    # Fallback: if extraction fails, try first user message
    if not main_question:
        user_msgs = [msg['content'] for msg in chat_history if msg['role'] == 'user']
        main_question = user_msgs[0] if user_msgs else None

    if not main_question:
        return jsonify({'answer': 'No main question found to reveal the answer for.'})

    # 2. Use Gemini to get the direct answer to the main question
    direct_prompt = f"""
You are an expert tutor. The student asked: {main_question}

Give the exact answer in a clear and direct way. Do not provide hints, motivation, or encouragement. If code is needed, provide it as a code block. Bold the final answer if possible.
"""
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": direct_prompt}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "topK": 32,
            "topP": 0.95,
            "maxOutputTokens": 2048
        }
    }
    try:
        r = requests.post(GEMINI_API_URL, json=payload)
        r.raise_for_status()
        data = r.json()
        answer = data['candidates'][0]['content']['parts'][0]['text']
        answer = post_process_response(answer)
    except Exception as e:
        answer = f"Sorry, there was an error revealing the answer: {e}"
    return jsonify({'answer': answer})

if __name__ == '__main__':
    app.run(debug=True) 