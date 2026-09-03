const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export type NutritionField = {
  value: number | null;
  unit: string;
  confidence: number;
};

export type ProgressiveNutritionData = {
  product_name: string | null;
  restaurant_name: string | null;
  serving_size: NutritionField;
  servings_per_container: number | null;
  /** True when the model inferred macros from knowledge rather than reading them off the image. */
  is_estimate: boolean;
  nutrition: Record<string, NutritionField>;
};

const emptyField = (): NutritionField => ({ value: null, unit: '', confidence: 0 });

export const createEmptyNutritionData = (): ProgressiveNutritionData => ({
  product_name: null,
  restaurant_name: null,
  serving_size: emptyField(),
  servings_per_container: null,
  is_estimate: false,
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

const JSON_SHAPE = `
Return ONLY a valid, raw JSON object with no markdown formatting.
Ensure the keys inside each nutrition field object are strictly ordered: "value", then "unit", then "confidence".
Confidence must be a number between 0.0 and 1.0.

Structure:
{
  "product_name": "String (or null)",
  "restaurant_name": "String (or null)",
  "is_estimate": Boolean,
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

const LABEL_PROMPT = `
You are an expert nutritionist and OCR system.
Analyze the provided image of a nutrition facts label.
Extract nutrition fields individually. Do not wait to find all of them before returning.

Read the values printed on the label. Set "is_estimate" to false.
Leave "restaurant_name" as null unless a brand is clearly printed on the packaging.
${JSON_SHAPE}`;

const MENU_PROMPT = `
You are an expert nutritionist analyzing a photo of a restaurant menu, menu board,
drive-thru sign, receipt, or fast-food packaging.

Identify the single most prominent food item in the image. If several items are visible,
choose the one that is largest, centered, or most clearly the subject of the photo.

Then determine its nutrition for ONE STANDARD SERVING as sold.

Rules:
- "product_name" is the menu item name as written, e.g. "Chickenjoy with Rice".
- "restaurant_name" is the chain or restaurant if identifiable, otherwise null.
- "serving_size" is the total weight of one serving in grams.
- All nutrition values are for ONE STANDARD SERVING, never per 100g.
- If the image shows printed nutrition values, read them and set "is_estimate" to false.
  Otherwise estimate from your knowledge of this chain's published data and set it to true.
- "confidence" must be honest: 0.9+ only when recalling a chain's published figure,
  0.5-0.7 for a reasoned estimate from a comparable item, below 0.4 when guessing.
- Emit fields as you determine them. Do not wait to resolve all of them before returning.
- If the image contains no identifiable food item, set "product_name" to null and all values to null.
${JSON_SHAPE}`;

/** Rejection message used when a scan is cancelled by the caller. Not an error worth logging. */
export const SCAN_ABORTED = 'scan-aborted';

/**
 * Streams a Gemini vision response, parsing nutrition fields out of the partial JSON
 * as they arrive so the UI can fill in progressively.
 *
 * Pass `signal` to let the caller cancel an in-flight scan; the promise then rejects
 * with `SCAN_ABORTED` and the underlying request is torn down.
 */
function streamGeminiScan(
  base64Image: string,
  prompt: string,
  onProgress: (partialData: ProgressiveNutritionData) => void,
  signal?: AbortSignal
): Promise<ProgressiveNutritionData> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    return Promise.reject(
      new Error('Missing Gemini API Key. Please add EXPO_PUBLIC_GEMINI_API_KEY to your .env file.')
    );
  }

  const model = process.env.EXPO_PUBLIC_GEMINI_VISION_MODEL || 'gemini-1.5-flash';
  // Use SSE streaming endpoint
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

  const state = createEmptyNutritionData();
  onProgress(state);

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error(SCAN_ABORTED));
      return;
    }

    const xhr = new XMLHttpRequest();
    let aborted = false;

    const handleAbort = () => {
      aborted = true;
      xhr.abort();
      reject(new Error(SCAN_ABORTED));
    };
    signal?.addEventListener('abort', handleAbort);
    const releaseSignal = () => signal?.removeEventListener('abort', handleAbort);

    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    let processedLength = 0;
    let buffer = '';
    let accumulatedText = '';

    xhr.onreadystatechange = () => {
      // xhr.abort() fires one last readyState change; ignore everything after cancellation.
      if (aborted) return;

      if (xhr.readyState === 3 || xhr.readyState === 4) {
        if (!xhr.responseText) return;

        const newData = xhr.responseText.substring(processedLength);
        processedLength = xhr.responseText.length;
        buffer += newData;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (!dataStr) continue;
            try {
              const dataObj = JSON.parse(dataStr);
              const textChunk = dataObj?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (textChunk) {
                accumulatedText += textChunk;

                const accText = accumulatedText;
                let updated = false;

                const prodNameMatch = accText.match(/"product_name"\s*:\s*"([^"]+)"/);
                if (prodNameMatch && state.product_name !== prodNameMatch[1]) {
                  state.product_name = prodNameMatch[1];
                  updated = true;
                }

                const restNameMatch = accText.match(/"restaurant_name"\s*:\s*"([^"]+)"/);
                if (restNameMatch && state.restaurant_name !== restNameMatch[1]) {
                  state.restaurant_name = restNameMatch[1];
                  updated = true;
                }

                const spcMatch = accText.match(/"servings_per_container"\s*:\s*([\d.]+)/);
                if (spcMatch && state.servings_per_container !== parseFloat(spcMatch[1])) {
                  state.servings_per_container = parseFloat(spcMatch[1]);
                  updated = true;
                }

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

        if (xhr.readyState === 4) {
          releaseSignal();
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              let cleanedJson = accumulatedText.trim();
              if (cleanedJson.startsWith('```json')) cleanedJson = cleanedJson.substring(7);
              else if (cleanedJson.startsWith('```')) cleanedJson = cleanedJson.substring(3);
              if (cleanedJson.endsWith('```')) cleanedJson = cleanedJson.substring(0, cleanedJson.length - 3);

              const parsed = JSON.parse(cleanedJson.trim());
              if (parsed.product_name) state.product_name = parsed.product_name;
              if (parsed.restaurant_name) state.restaurant_name = parsed.restaurant_name;
              if (typeof parsed.is_estimate === 'boolean') state.is_estimate = parsed.is_estimate;
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
              console.warn('Final JSON parse failed, relying on progressive data.');
            }
            resolve(state);
          } else {
            reject(new Error(`Gemini returned ${xhr.status}: ${xhr.responseText}`));
          }
        }
      }
    };

    xhr.onerror = () => {
      if (aborted) return;
      releaseSignal();
      reject(new Error('Network request failed'));
    };

    xhr.send(JSON.stringify({
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
    }));
  });
}

/** Reads printed values off a nutrition facts panel. */
export function scanNutritionFactsProgressive(
  base64Image: string,
  onProgress: (partialData: ProgressiveNutritionData) => void,
  signal?: AbortSignal
): Promise<ProgressiveNutritionData> {
  return streamGeminiScan(base64Image, LABEL_PROMPT, onProgress, signal);
}

/** Identifies a menu item and estimates macros for one standard serving. */
export function scanMenuItemProgressive(
  base64Image: string,
  onProgress: (partialData: ProgressiveNutritionData) => void,
  signal?: AbortSignal
): Promise<ProgressiveNutritionData> {
  return streamGeminiScan(base64Image, MENU_PROMPT, onProgress, signal);
}

/**
 * Lowest confidence across every field the model actually filled in.
 * Returns 1 when nothing was found, so callers should check for values first.
 */
export function lowestConfidence(data: ProgressiveNutritionData): number {
  const fields = [data.serving_size, ...Object.values(data.nutrition)];
  return fields.reduce(
    (min, f) => (f.value !== null && f.confidence < min ? f.confidence : min),
    1
  );
}
