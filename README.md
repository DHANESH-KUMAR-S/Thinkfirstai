# ThinkFirst: Mindful AI Learning Assistant

ThinkFirst is a web-based AI learning assistant designed to encourage independent thinking and mindful learning. Built with Flask and Google Gemini API, it guides students through problem-solving, provides hints, and only reveals the exact answer when requested via a special 'Reveal Answer' button.

## Features
- Encourages students to attempt problems before revealing answers
- Uses AI to extract the main/original question from chat history
- 'Reveal Answer' button gives the direct answer to the main question
- Modern, responsive UI with Tailwind CSS
- Session-based chat history and attempt tracking

## Tech Stack
- Python (Flask, Flask-CORS, Requests)
- Google Gemini API (Generative Language)
- Gunicorn (for production WSGI server)
- JavaScript (frontend logic)
- Tailwind CSS (styling)

## Getting Started

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd thinkfirst
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Set up your Gemini API key
Edit `app.py` and set your Gemini API key in the `GEMINI_API_KEY` variable.

### 4. Run locally
```bash
flask run
```
Or for production:
```bash
gunicorn app:app
```

## Deploying on Render
1. Connect your GitHub repo to Render.
2. Set the build and start commands:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
3. Set any necessary environment variables (e.g., for your Gemini API key).
4. Deploy!

## License
MIT 