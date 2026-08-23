const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export type NutritionField = {
  value: number | null;
  unit: string;
  confidence: number;
};

export type ProgressiveNutritionData = {
  product_name: string | null;
  serving_size: NutritionField;
  servings_per_container: number | null;
  nutrition: Record<string, NutritionField>;
};

const emptyField = (): NutritionField => ({ value: null, unit: '', confidence: 0 });

export const createEmptyNutritionData = (): ProgressiveNutritionData => ({
  product_name: null,
  serving_size: emptyField(),
  servings_per_container: null,
  nutrition: {
    calories: emptyField(),
    total_fat: emptyField(),
    saturated_fat: emptyField(),
    trans_fat: emptyField(),
    cholesterol: emptyField(),
    sodium: emptyField(),
    total_carbohydrates: emptyField(),
    dietary_fiber: emptyField(),
    total_sugars: emptyField(),
    added_sugars: emptyField(),
    protein: emptyField(),
  },
});

export async function scanNutritionFactsProgressive(
  base64Image: string,
  onProgress: (partialData: ProgressiveNutritionData) => void
): Promise<ProgressiveNutritionData> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    throw new Error('Missing Gemini API Key. Please add EXPO_PUBLIC_GEMINI_API_KEY to your .env file.');
  }

  const model = process.env.EXPO_PUBLIC_GEMINI_RECEIPT_MODEL || 'gemini-2.5-flash';
  // Use SSE streaming endpoint
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

  const prompt = `
You are an expert nutritionist and OCR system.
Analyze the provided image of a nutrition facts label.
Extract nutrition fields individually. Do not wait to find all of them before returning.

Return ONLY a valid, raw JSON object with no markdown formatting.
Ensure the keys inside each nutrition field object are strictly ordered: "value", then "unit", then "confidence".
Confidence must be a number between 0.0 and 1.0.

Structure:
{
  "product_name": "String (or null)",
  "serving_size": { "value": Number, "unit": "g", "confidence": Number },
  "servings_per_container": Number,
  "nutrition": {
    "calories": { "value": Number, "unit": "kcal", "confidence": Number },
    "total_fat": { "value": Number, "unit": "g", "confidence": Number },
    "saturated_fat": { "value": Number, "unit": "g", "confidence": Number },
    "trans_fat": { "value": Number, "unit": "g", "confidence": Number },
    "cholesterol": { "value": Number, "unit": "mg", "confidence": Number },
    "sodium": { "value": Number, "unit": "mg", "confidence": Number },
    "total_carbohydrates": { "value": Number, "unit": "g", "confidence": Number },
    "dietary_fiber": { "value": Number, "unit": "g", "confidence": Number },
    "total_sugars": { "value": Number, "unit": "g", "confidence": Number },
    "added_sugars": { "value": Number, "unit": "g", "confidence": Number },
    "protein": { "value": Number, "unit": "g", "confidence": Number }
  }
}
`;

  const state = createEmptyNutritionData();
  onProgress(state);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Gemini returned ${response.status}: ${errorData}`);
    }

    if (!response.body) {
      throw new Error('No response body from stream');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      // Extract raw text chunks from SSE format
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep the incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.replace('data: ', '').trim();
          if (!dataStr) continue;
          try {
            const dataObj = JSON.parse(dataStr);
            const textChunk = dataObj?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textChunk) {
              // Accumulate text stream for progressive extraction
              (state as any).accumulatedText = (state as any).accumulatedText || '';
              (state as any).accumulatedText += textChunk;
              
              // Progressive Regex Extraction
              const accText = (state as any).accumulatedText;
              let updated = false;

              // 1. Match product_name
              const prodNameMatch = accText.match(/"product_name"\s*:\s*"([^"]+)"/);
              if (prodNameMatch && state.product_name !== prodNameMatch[1]) {
                state.product_name = prodNameMatch[1];
                updated = true;
              }

              // 2. Match servings_per_container
              const spcMatch = accText.match(/"servings_per_container"\s*:\s*([\d.]+)/);
              if (spcMatch && state.servings_per_container !== parseFloat(spcMatch[1])) {
                state.servings_per_container = parseFloat(spcMatch[1]);
                updated = true;
              }

              // 3. Match nested fields: "key": { "value": 123, "unit": "g", "confidence": 0.9 }
              // This relies on the strict order requested in the prompt.
              const fieldRegex = /"([a-z_]+)"\s*:\s*{\s*"value"\s*:\s*([\d.]+)\s*,\s*"unit"\s*:\s*"([^"]+)"\s*,\s*"confidence"\s*:\s*([\d.]+)\s*}/g;
              let match;
              while ((match = fieldRegex.exec(accText)) !== null) {
                const [_, key, val, unit, conf] = match;
                const valueNum = parseFloat(val);
                const confNum = parseFloat(conf);
                
                if (key === 'serving_size') {
                  if (state.serving_size.value !== valueNum) {
                    state.serving_size = { value: valueNum, unit, confidence: confNum };
                    updated = true;
                  }
                } else if (state.nutrition[key] !== undefined) {
                  if (state.nutrition[key].value !== valueNum) {
                    state.nutrition[key] = { value: valueNum, unit, confidence: confNum };
                    updated = true;
                  }
                }
              }

              if (updated) {
                onProgress({ ...state });
              }
            }
          } catch (e) {
            // Ignore parse errors for partial SSE chunks
          }
        }
      }
    }

    // Final attempt to parse complete JSON if regex missed anything
    const finalText = (state as any).accumulatedText || '';
    try {
      let cleanedJson = finalText.trim();
      if (cleanedJson.startsWith('```json')) cleanedJson = cleanedJson.substring(7);
      else if (cleanedJson.startsWith('```')) cleanedJson = cleanedJson.substring(3);
      if (cleanedJson.endsWith('```')) cleanedJson = cleanedJson.substring(0, cleanedJson.length - 3);
      
      const parsed = JSON.parse(cleanedJson.trim());
      if (parsed.product_name) state.product_name = parsed.product_name;
      if (parsed.servings_per_container) state.servings_per_container = parsed.servings_per_container;
      if (parsed.serving_size?.value !== undefined) state.serving_size = parsed.serving_size;
      
      if (parsed.nutrition) {
        for (const [k, v] of Object.entries(parsed.nutrition)) {
          if (state.nutrition[k] && (v as any).value !== undefined) {
            state.nutrition[k] = v as NutritionField;
          }
        }
      }
      onProgress({ ...state });
    } catch (e) {
      console.error('Final JSON parse failed, relying on progressive data.');
    }

    return state;

  } catch (err: any) {
    console.error('Nutrition Scan Error:', err);
    throw new Error(err.message || 'Failed to analyze nutrition facts.');
  }
}
