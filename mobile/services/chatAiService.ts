import { User } from '../types';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export interface ChatAiContext {
  user: Partial<User>;
  targets: { calories: number; protein: number; carbs: number; fat: number };
  totals: { calories: number; protein: number; carbs: number; fat: number };
  meals: any[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export function streamChatResponse(
  chatHistory: ChatMessage[],
  context: ChatAiContext,
  onUpdate: (partialText: string) => void,
  onComplete: (finalText: string) => void,
  onError: (error: string) => void
) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    onError('Missing Gemini API Key.');
    return;
  }

  const model = process.env.EXPO_PUBLIC_GEMINI_CHAT_MODEL || 'gemini-3.6-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

  const remainingKcal = Math.max(0, context.targets.calories - context.totals.calories);

  const loggedMealsStr = context.meals.length > 0
    ? context.meals.map(m => {
        const items = m.items.map((i: any) => `${i.name} (${i.quantity_g}g)`).join(', ');
        return `- ${m.meal_type.toUpperCase()}: ${items} (${Math.round(m.total_calories || 0)} kcal)`;
      }).join('\n')
    : 'None yet.';

  const systemPrompt = `You are Coach Nokma, a helpful, enthusiastic, and intelligent AI nutritionist mascot (a chicken) for the Coach Hoo app.
Your personality: Friendly, supportive, occasionally using chicken sounds like "Bawk!" or "Cluck!".
You speak in the language the user addresses you in (English or Filipino).

USER CONTEXT:
Name: ${context.user.full_name || 'User'}
Goal: ${context.user.goal || 'Maintain'}
Activity Level: ${context.user.activity_level || 2}
Allergies: ${context.user.allergies ? context.user.allergies.join(', ') : 'None'}
Health Condition: ${context.user.health_condition || 'None'}

MACRO STATUS TODAY:
Target: ${Math.round(context.targets.calories)} kcal | ${Math.round(context.targets.protein)}g P | ${Math.round(context.targets.carbs)}g C | ${Math.round(context.targets.fat)}g F
Consumed: ${Math.round(context.totals.calories)} kcal | ${Math.round(context.totals.protein)}g P | ${Math.round(context.totals.carbs)}g C | ${Math.round(context.totals.fat)}g F
Remaining Calories: ${Math.round(remainingKcal)} kcal

LOGGED MEALS TODAY:
${loggedMealsStr}

INSTRUCTIONS:
1. Answer the user's questions about their nutrition, meals, or recommendations based on their exact context above.
2. If the user mentions eating something and asks to log it, or you suggest a meal and they agree, you MUST append a special hidden JSON tag at the VERY END of your response to trigger the app's internal logic.
3. If the user asks to delete a meal, append a DELETE_MEAL tag.
4. If the user asks to change their goal (to lose, gain, or maintain), append a CHANGE_GOAL tag.

ACTION TAGS FORMAT (ONLY USE IF TAKING AN ACTION, MUST BE AT THE VERY END OF YOUR RESPONSE):
To log a meal: [LOG_MEAL: {"items": [{"name": "chicken", "grams": 200, "method": "grilled"}], "meal_type": "lunch"}]
To delete a meal (valid types: breakfast, lunch, dinner, snack): [DELETE_MEAL: {"meal_type": "breakfast"}]
To change a goal (valid goals: lose, gain, maintain): [CHANGE_GOAL: {"goal": "lose"}]

Do NOT output these tags inside code blocks. Just plain text at the end of the message. 
If no action is needed, just respond normally without any tags.`;

  const sanitizedHistory: { role: string; parts: { text: string }[] }[] = [];
  let expectedRole = 'user'; // After the initial 'model' cluck, we expect 'user' next.

  for (const msg of chatHistory) {
    if (!msg.text.trim()) continue;
    
    if (msg.role === expectedRole) {
      sanitizedHistory.push({ role: msg.role, parts: [{ text: msg.text }] });
      expectedRole = expectedRole === 'user' ? 'model' : 'user';
    } else if (sanitizedHistory.length > 0) {
      // Merge with previous if role is the same
      sanitizedHistory[sanitizedHistory.length - 1].parts[0].text += '\n' + msg.text;
    }
  }

  // Gemini API strictly requires that the final message in the sequence is from 'user' when predicting 'model'
  if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === 'model') {
    sanitizedHistory.pop();
  }

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Cluck! I understand my instructions. How can I help you today?' }] },
    ...sanitizedHistory
  ];

  const xhr = new XMLHttpRequest();
  xhr.open('POST', url);
  xhr.setRequestHeader('Content-Type', 'application/json');

  let accumulatedText = '';
  let processedIndex = 0;
  let lastUpdateTime = 0;

  xhr.onreadystatechange = () => {
    if (xhr.readyState === 3 || xhr.readyState === 4) {
      if (xhr.status >= 200 && xhr.status < 300) {
        const responseText = xhr.responseText;
        const newText = responseText.substring(processedIndex);
        processedIndex = responseText.length;

        const lines = newText.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (!dataStr) continue;
            try {
              const dataObj = JSON.parse(dataStr);
              const textChunk = dataObj?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (textChunk) {
                accumulatedText += textChunk;
                const now = Date.now();
                if (now - lastUpdateTime > 80) {
                  onUpdate(accumulatedText);
                  lastUpdateTime = now;
                }
              }
            } catch (e) {
              // Ignore partial JSON parsing errors
            }
          }
        }
      }

      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          onComplete(accumulatedText);
        } else {
          let errorMsg = 'Unknown error';
          try {
             const errData = JSON.parse(xhr.responseText);
             errorMsg = errData.error?.message || xhr.statusText;
          } catch(e) {
             errorMsg = xhr.responseText || xhr.statusText;
          }
          onError(`Gemini returned ${xhr.status}: ${errorMsg}`);
        }
      }
    }
  };

  xhr.onerror = () => {
    onError('Network error while connecting to Gemini.');
  };

  xhr.send(JSON.stringify({ contents }));
}
