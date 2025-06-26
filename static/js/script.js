// Dark mode setup
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark');
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    if (event.matches) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
});

// Global variables
let chatHistory = [];
let userProfile = {};
let reflectionCount = 0;
let isReflectionMode = true;

// Gemini API configuration
const apiKey = "AIzaSyCOFOoppNQRakvBcKyKmWHEHpMBPODi9s4";
const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

// Function to call Gemini API
async function callGeminiAPI(prompt) {
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: prompt }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.4,
                    topK: 32,
                    topP: 0.95,
                    maxOutputTokens: 8192
                }
            })
        });

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return "I'm sorry, I'm having trouble connecting right now. Please try again.";
    }
}

function startReflection() {
    document.getElementById('welcomeStep').classList.add('hidden');
    document.getElementById('profileStep').classList.remove('hidden');
}

function completeProfile() {
    const name = document.getElementById('userName').value.trim();
    const subject = document.getElementById('userSubject').value.trim();
    const level = document.getElementById('userLevel').value;

    if (!name || !subject || !level) {
        alert('Please fill in all fields to continue.');
        return;
    }

    userProfile = { name, subject, level };
    document.getElementById('sessionInfo').textContent = `Session: ${name} - ${subject}`;
    
    document.getElementById('profileStep').classList.add('hidden');
    document.getElementById('guidelinesStep').classList.remove('hidden');
}

function startChat() {
    document.getElementById('reflectionPhase').classList.add('hidden');
    document.getElementById('chatInterface').classList.remove('hidden');
    
    // Add welcome message
    addMessage('assistant', `Welcome ${userProfile.name}! I'm here to help you learn ${userProfile.subject}. Remember, I'll guide you to think through problems yourself first. What would you like to work on today?`);
    isReflectionMode = false;
}

// Add a message to the chat UI
function addMessage(role, content, isThinking = false) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} fade-in`;

    const avatar = role === 'user' ? '👤' : '🤖';
    const bgColor = role === 'user' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100';

    // Format content: bold (**text**) and code blocks (```...```)
    let formattedContent = content
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>') // code blocks
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // bold
        .replace(/\n/g, '<br>'); // newlines

    messageDiv.innerHTML = `
        <div class="flex items-start space-x-3 max-w-3xl">
            ${role === 'assistant' ? `<div class="w-8 h-8 ${isThinking ? 'thinking-animation' : ''} bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center text-sm">${avatar}</div>` : ''}
            <div class="${bgColor} px-4 py-3 rounded-lg max-w-2xl break-words">
                ${formattedContent}
            </div>
            ${role === 'user' ? `<div class="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-sm">${avatar}</div>` : ''}
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    chatHistory.push({ role, content, timestamp: new Date().toISOString() });
}

function hideReflectionPrompt() {
    document.getElementById('reflectionPrompt')?.classList.add('hidden');
    isReflectionMode = false;
}

function shouldShowReflectionPrompt(message) {
    const reflectionKeywords = ['help', 'how do', 'what is', 'explain', 'solve', 'answer', 'tell me'];
    const hasKeyword = reflectionKeywords.some(keyword => message.toLowerCase().includes(keyword));
    // Show reflection prompt if it's a help request and user hasn't reflected much yet
    return hasKeyword && reflectionCount < 2 && !message.toLowerCase().includes('tried') && !message.toLowerCase().includes('attempted');
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    if (!message) return;
    // Check if we should show reflection prompt
    if (shouldShowReflectionPrompt(message) && !isReflectionMode) {
        document.getElementById('reflectionPrompt')?.classList.remove('hidden');
        reflectionCount++;
        isReflectionMode = true;
        return;
    }
    input.value = '';
    document.getElementById('sendButton').disabled = true;
    // Add user message
    addMessage('user', message);
    // Add thinking indicator
    addMessage('assistant', 'Thinking...', true);
    // Prepare context-aware prompt
    const systemPrompt = `You are a mindful AI learning assistant for ${userProfile.name}, who is studying ${userProfile.subject} at a ${userProfile.level} level. \n\nYour core principles:\n1. Encourage independent thinking before providing direct answers\n2. Ask guiding questions that lead students to discover answers themselves\n3. Provide hints and scaffolding rather than complete solutions\n4. Celebrate attempts and learning from mistakes\n5. Adapt your approach based on the student's demonstrated effort\n\nPrevious conversation context:\n${chatHistory.slice(-6).map(msg => `${msg.role}: ${msg.content}`).join('\n')}\n\nCurrent message: ${message}\n\nGuidelines for your response:\n- If the student shows they've attempted the problem, provide helpful guidance\n- If they haven't shown effort, encourage them to try first with specific steps\n- Use encouraging language that builds confidence\n- Break complex problems into smaller, manageable steps\n- Always acknowledge what they've done right before correcting mistakes\n\nRespond in a supportive, educational manner that promotes learning and growth.`;
    try {
        const response = await callGeminiAPI(systemPrompt);
        // Remove thinking message
        const messages = document.getElementById('chatMessages');
        messages.removeChild(messages.lastChild);
        // Add AI response
        addMessage('assistant', response);
    } catch (error) {
        // Remove thinking message
        const messages = document.getElementById('chatMessages');
        messages.removeChild(messages.lastChild);
        addMessage('assistant', 'I apologize, but I encountered an error. Please try again.');
    }
    document.getElementById('sendButton').disabled = false;
    input.focus();
}

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}
// Focus input when chat starts
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const input = document.getElementById('messageInput');
        if (input) input.focus();
    }, 1000);
});

// Reveal the answer for the last question using the full chat history
async function revealAnswer() {
    const btn = document.getElementById('revealAnswerBtn');
    btn.disabled = true;
    btn.textContent = 'Revealing...';
    try {
        // Always send userProfile and full chatHistory to backend for robust answer extraction
        const response = await fetch('/reveal_answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userProfile, chatHistory })
        });
        const data = await response.json();
        addMessage('assistant', data.answer);
        btn.textContent = 'Answer Revealed';
    } catch (e) {
        addMessage('assistant', 'Sorry, there was an error revealing the answer.');
        btn.textContent = 'Reveal Answer';
        btn.disabled = false;
    }
} 