
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { RecipeOption, DetailedRecipe } from "./types";

const SYSTEM_INSTRUCTION = `Você é o ChefIA, um assistente inteligente especializado em criar receitas práticas, gostosas e realistas para o dia a dia, usando apenas os ingredientes que o usuário já tem em casa.
Seu objetivo é ajudar pessoas com fome a cozinharem algo fácil, evitando compras extras.
Use linguagem simples, brasileira e amigável. Nunca invente ingredientes.
Sempre retorne os dados no formato JSON especificado.`;

export const analyzeIngredients = async (
  input: string | { data: string; mimeType: string },
  isMedia: boolean = false
): Promise<{ ingredients: string[]; recipes: RecipeOption[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const model = 'gemini-3-flash-preview';
  
  const promptText = isMedia 
    ? "Identifique os ingredientes nesta mídia e sugira 3 receitas simples que podem ser feitas com eles ou com poucos itens extras comuns (sal, óleo, açúcar). Retorne um JSON com a lista de 'ingredients' identificados e as 'recipes' (id, name, time, extraIngredients)."
    : `Com base nestes ingredientes: "${input}", sugira 3 receitas simples. Retorne um JSON com a lista de 'ingredients' e as 'recipes' (id, name, time, extraIngredients).`;

  const parts: any[] = [];
  
  if (isMedia) {
    const mediaInput = input as { data: string; mimeType: string };
    parts.push({
      inlineData: {
        data: mediaInput.data,
        mimeType: mediaInput.mimeType
      }
    });
  }
  
  parts.push({ text: promptText });

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          ingredients: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          recipes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.NUMBER },
                name: { type: Type.STRING },
                time: { type: Type.STRING },
                extraIngredients: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["id", "name", "time", "extraIngredients"]
            }
          }
        },
        required: ["ingredients", "recipes"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Resposta vazia do modelo");
  return JSON.parse(text);
};

export const getRecipeDetails = async (
  recipeName: string,
  availableIngredients: string[]
): Promise<DetailedRecipe> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const model = 'gemini-3-flash-preview';
  const prompt = `Gere o modo de preparo detalhado para a receita "${recipeName}" usando os ingredientes: ${availableIngredients.join(', ')}.
  Retorne um JSON com: name, ingredients (somente os usados), instructions (lista de passos curtos), tips (lista de dicas e substituições).`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
          instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
          tips: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["name", "ingredients", "instructions", "tips"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Resposta vazia do modelo");
  const data = JSON.parse(text);
  // Adiciona um ID baseado no nome para os favoritos
  return { ...data, id: btoa(data.name).substring(0, 10) };
};
