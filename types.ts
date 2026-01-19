
export interface RecipeOption {
  id: number;
  name: string;
  time: string;
  extraIngredients: string[];
}

export interface DetailedRecipe {
  name: string;
  ingredients: string[];
  instructions: string[];
  tips: string[];
  id?: string; // ID único para controle de favoritos
}

export interface ProcessingState {
  status: 'idle' | 'analyzing' | 'listing' | 'cooking' | 'favorites';
  error?: string;
}

export enum InputMethod {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO'
}
