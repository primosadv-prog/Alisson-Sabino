
import React, { useState, useRef, useEffect } from 'react';
import { 
  ChefHat, 
  Camera, 
  Mic, 
  Type as TextIcon, 
  Loader2, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  PlusCircle,
  X,
  Send,
  Heart,
  Bookmark
} from 'lucide-react';
import { analyzeIngredients, getRecipeDetails } from './geminiService';
import { RecipeOption, DetailedRecipe, ProcessingState, InputMethod } from './types';

export default function App() {
  const [method, setMethod] = useState<InputMethod | null>(null);
  const [textInput, setTextInput] = useState('');
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<DetailedRecipe | null>(null);
  const [state, setState] = useState<ProcessingState>({ status: 'idle' });
  const [isRecording, setIsRecording] = useState(false);
  const [favorites, setFavorites] = useState<DetailedRecipe[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Carregar favoritos do LocalStorage ao iniciar
  useEffect(() => {
    const saved = localStorage.getItem('chefia_favorites');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar favoritos");
      }
    }
  }, []);

  // Salvar favoritos sempre que mudarem
  useEffect(() => {
    localStorage.setItem('chefia_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const reset = () => {
    setMethod(null);
    setTextInput('');
    setIngredients([]);
    setRecipes([]);
    setSelectedRecipe(null);
    setState({ status: 'idle' });
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    setState({ status: 'analyzing' });
    try {
      const result = await analyzeIngredients(textInput);
      setIngredients(result.ingredients);
      setRecipes(result.recipes);
      setState({ status: 'listing' });
    } catch (error) {
      setState({ status: 'idle', error: 'Erro ao analisar ingredientes. Tente novamente.' });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setState({ status: 'analyzing' });
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const result = await analyzeIngredients({
          data: base64Data,
          mimeType: file.type
        }, true);
        setIngredients(result.ingredients);
        setRecipes(result.recipes);
        setState({ status: 'listing' });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setState({ status: 'idle', error: 'Erro ao processar imagem. Tente novamente.' });
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Data = (reader.result as string).split(',')[1];
          setState({ status: 'analyzing' });
          try {
            const result = await analyzeIngredients({
              data: base64Data,
              mimeType: 'audio/webm'
            }, true);
            setIngredients(result.ingredients);
            setRecipes(result.recipes);
            setState({ status: 'listing' });
          } catch (error) {
            setState({ status: 'idle', error: 'Erro ao processar áudio. Tente novamente.' });
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Microphone error:', error);
      alert('Não foi possível acessar o microfone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleSelectRecipe = async (recipe: RecipeOption) => {
    setState({ status: 'cooking' });
    try {
      const details = await getRecipeDetails(recipe.name, ingredients);
      setSelectedRecipe(details);
    } catch (error) {
      setState({ status: 'listing', error: 'Erro ao carregar detalhes da receita.' });
    }
  };

  const toggleFavorite = (recipe: DetailedRecipe) => {
    const isFav = favorites.some(f => f.name === recipe.name);
    if (isFav) {
      setFavorites(favorites.filter(f => f.name !== recipe.name));
    } else {
      setFavorites([...favorites, recipe]);
    }
  };

  const isFavorited = (name: string) => favorites.some(f => f.name === name);

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto bg-white shadow-xl ring-1 ring-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={reset}>
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-200">
            <ChefHat size={24} />
          </div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">ChefIA</h1>
        </div>
        <div className="flex items-center gap-2">
          {favorites.length > 0 && state.status === 'idle' && !method && (
            <button 
              onClick={() => setState({ status: 'favorites' })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-sm font-bold border border-orange-100"
            >
              <Heart size={16} fill="currentColor" /> {favorites.length}
            </button>
          )}
          {state.status !== 'idle' && (
            <button 
              onClick={reset}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        {state.status === 'idle' && !method && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold text-gray-900 leading-tight">O que temos para hoje?</h2>
              <p className="text-gray-500 text-lg">Escolha como quer me mostrar seus ingredientes.</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => setMethod(InputMethod.TEXT)}
                className="group flex items-center p-6 bg-white border-2 border-gray-100 rounded-2xl hover:border-orange-500 hover:shadow-xl hover:shadow-orange-100 transition-all text-left"
              >
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                  <TextIcon size={28} />
                </div>
                <div className="ml-5">
                  <h3 className="font-bold text-gray-900 text-lg">Escrever lista</h3>
                  <p className="text-gray-500">Digite o que tem na despensa</p>
                </div>
              </button>

              <button 
                onClick={() => fileInputRef.current?.click()}
                className="group flex items-center p-6 bg-white border-2 border-gray-100 rounded-2xl hover:border-orange-500 hover:shadow-xl hover:shadow-orange-100 transition-all text-left"
              >
                <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                  <Camera size={28} />
                </div>
                <div className="ml-5">
                  <h3 className="font-bold text-gray-900 text-lg">Tirar foto</h3>
                  <p className="text-gray-500">Mostre sua geladeira ou bancada</p>
                </div>
              </button>

              <button 
                onClick={() => setMethod(InputMethod.AUDIO)}
                className="group flex items-center p-6 bg-white border-2 border-gray-100 rounded-2xl hover:border-orange-500 hover:shadow-xl hover:shadow-orange-100 transition-all text-left"
              >
                <div className="w-14 h-14 bg-green-50 text-green-600 rounded-xl flex items-center justify-center group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                  <Mic size={28} />
                </div>
                <div className="ml-5">
                  <h3 className="font-bold text-gray-900 text-lg">Falar ingredientes</h3>
                  <p className="text-gray-500">Me conte o que você encontrou</p>
                </div>
              </button>
            </div>

            {/* Favoritos na Home */}
            {favorites.length > 0 && (
              <div className="pt-4 animate-in fade-in duration-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Bookmark size={20} className="text-orange-500" /> Suas Favoritas
                  </h3>
                  <button 
                    onClick={() => setState({ status: 'favorites' })}
                    className="text-sm font-bold text-orange-600 hover:underline"
                  >
                    Ver todas
                  </button>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                  {favorites.slice(0, 5).map((fav, i) => (
                    <div 
                      key={i} 
                      onClick={() => setSelectedRecipe(fav)}
                      className="min-w-[180px] p-4 bg-orange-50 rounded-2xl border border-orange-100 cursor-pointer hover:shadow-md transition-shadow shrink-0"
                    >
                      <h4 className="font-bold text-gray-800 line-clamp-2 mb-2 h-10">{fav.name}</h4>
                      <div className="flex items-center gap-1 text-xs text-orange-600 font-medium">
                        <Clock size={12} /> Pronta para ver
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>
        )}

        {/* Favorites View */}
        {state.status === 'favorites' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <button onClick={() => setState({ status: 'idle' })} className="flex items-center text-sm font-medium text-gray-500 hover:text-orange-600 transition-colors">
              <ArrowLeft size={16} className="mr-1" /> Voltar
            </button>
            <h2 className="text-2xl font-bold text-gray-900">Suas Receitas Favoritas</h2>
            <div className="grid grid-cols-1 gap-4">
              {favorites.map((fav, i) => (
                <div 
                  key={i}
                  className="w-full text-left p-6 bg-white border border-gray-100 rounded-2xl hover:border-orange-500 hover:shadow-lg transition-all flex items-center justify-between group"
                >
                  <div className="cursor-pointer flex-1" onClick={() => setSelectedRecipe(fav)}>
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
                      {fav.name}
                    </h3>
                    <p className="text-sm text-gray-500">{fav.ingredients.length} ingredientes salvos</p>
                  </div>
                  <button 
                    onClick={() => toggleFavorite(fav)}
                    className="p-3 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <Heart size={20} fill="currentColor" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Views */}
        {method === InputMethod.TEXT && state.status === 'idle' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <button onClick={() => setMethod(null)} className="flex items-center text-sm font-medium text-gray-500 hover:text-orange-600 transition-colors">
              <ArrowLeft size={16} className="mr-1" /> Voltar
            </button>
            <h2 className="text-2xl font-bold text-gray-900">Liste seus ingredientes</h2>
            <div className="relative">
              <textarea 
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Ex: 2 ovos, 1 batata, queijo, cebola..."
                className="w-full h-40 p-5 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none transition-all"
              />
              <button 
                onClick={handleTextSubmit}
                disabled={!textInput.trim()}
                className="absolute bottom-4 right-4 bg-orange-500 text-white p-3 rounded-xl shadow-lg shadow-orange-200 disabled:opacity-50 disabled:shadow-none hover:bg-orange-600 transition-all"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        )}

        {method === InputMethod.AUDIO && state.status === 'idle' && (
          <div className="space-y-8 text-center animate-in slide-in-from-right-4 duration-300">
            <button onClick={() => setMethod(null)} className="flex items-center text-sm font-medium text-gray-500 hover:text-orange-600 transition-colors">
              <ArrowLeft size={16} className="mr-1" /> Voltar
            </button>
            <h2 className="text-2xl font-bold text-gray-900">Pode falar, estou ouvindo!</h2>
            <div className="flex flex-col items-center justify-center gap-6 py-10">
              <button 
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
                  isRecording 
                  ? 'bg-red-500 scale-110 shadow-red-200 animate-pulse' 
                  : 'bg-orange-500 shadow-orange-200 hover:scale-105'
                }`}
              >
                <Mic size={48} className="text-white" />
              </button>
              <p className="text-gray-500 font-medium">
                {isRecording ? 'Solte para terminar' : 'Segure para falar'}
              </p>
            </div>
          </div>
        )}

        {/* Processing State */}
        {(state.status === 'analyzing' || state.status === 'cooking') && (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
            <div className="text-center">
              <p className="text-xl font-bold text-gray-900">
                {state.status === 'analyzing' ? 'Analisando ingredientes...' : 'Preparando sua receita...'}
              </p>
              <p className="text-gray-500">Isso leva apenas alguns segundos.</p>
            </div>
          </div>
        )}

        {/* Results List */}
        {state.status === 'listing' && recipes.length > 0 && !selectedRecipe && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100">
              <h3 className="font-bold text-orange-900 flex items-center gap-2 mb-2">
                <CheckCircle2 size={18} /> Ingredientes encontrados:
              </h3>
              <div className="flex flex-wrap gap-2">
                {ingredients.map((ing, i) => (
                  <span key={i} className="px-3 py-1 bg-white rounded-full text-sm font-medium text-orange-700 border border-orange-200">
                    {ing}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">Sugestões para você:</h2>
              {recipes.map((recipe) => (
                <button 
                  key={recipe.id}
                  onClick={() => handleSelectRecipe(recipe)}
                  className="w-full text-left p-6 bg-white border border-gray-100 rounded-2xl hover:border-orange-500 hover:shadow-lg transition-all flex items-center justify-between group"
                >
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
                      {recipe.id}. {recipe.name}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock size={14} /> {recipe.time}
                      </span>
                      {recipe.extraIngredients.length > 0 ? (
                        <span className="flex items-center gap-1 text-orange-600">
                          <PlusCircle size={14} /> +{recipe.extraIngredients.length} itens extras
                        </span>
                      ) : (
                        <span className="text-green-600 font-medium">Tudo o que você já tem!</span>
                      )}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors">
                    <ArrowLeft size={16} className="rotate-180" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Recipe */}
        {selectedRecipe && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-10">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-gray-900">{selectedRecipe.name}</h2>
                <div className="w-16 h-1 bg-orange-500 rounded-full" />
              </div>
              <button 
                onClick={() => toggleFavorite(selectedRecipe)}
                className={`p-3 rounded-2xl transition-all ${
                  isFavorited(selectedRecipe.name) 
                  ? 'bg-red-50 text-red-500 shadow-sm' 
                  : 'bg-gray-50 text-gray-400 hover:text-red-400'
                }`}
              >
                <Heart size={24} fill={isFavorited(selectedRecipe.name) ? 'currentColor' : 'none'} />
              </button>
            </div>

            <section className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wider text-sm opacity-50">Ingredientes</h3>
              <ul className="grid grid-cols-1 gap-2">
                {selectedRecipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="mt-1 w-2 h-2 bg-orange-400 rounded-full shrink-0" />
                    <span className="text-gray-700">{ing}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wider text-sm opacity-50">Modo de Preparo</h3>
              <div className="space-y-4">
                {selectedRecipe.instructions.map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-gray-700 leading-relaxed pt-1">{step}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4 bg-blue-50 p-6 rounded-2xl border border-blue-100">
              <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                <ChefHat size={20} className="text-blue-600" /> Dicas do ChefIA
              </h3>
              <ul className="space-y-2">
                {selectedRecipe.tips.map((tip, i) => (
                  <li key={i} className="text-blue-800 text-sm flex items-start gap-2">
                    <span className="text-blue-400">•</span> {tip}
                  </li>
                ))}
              </ul>
            </section>

            <button 
              onClick={() => {
                if (state.status === 'favorites') {
                   setSelectedRecipe(null);
                } else {
                   setSelectedRecipe(null);
                   setState({ status: 'listing' });
                }
              }}
              className="w-full py-4 bg-white border-2 border-gray-100 rounded-2xl text-gray-600 font-bold hover:bg-gray-50 transition-all"
            >
              Voltar para a lista
            </button>
          </div>
        )}
      </main>

      {/* Error Message */}
      {state.error && (
        <div className="p-4 bg-red-50 text-red-600 text-center text-sm font-medium border-t border-red-100">
          {state.error}
        </div>
      )}

      {/* Footer / Info */}
      <footer className="p-6 text-center text-gray-400 text-xs border-t border-gray-50">
        <p>© 2024 ChefIA — Inteligência Artificial para sua cozinha</p>
      </footer>
    </div>
  );
}
