// Base de datos de recetas iniciales
const defaultRecipes = [
  {
    id: "pancakes",
    title: "🥞 Pancakes Esponjosos",
    steps: [
      "Mezcla 1 taza de harina, 2 cucharadas de azúcar y una pizca de sal en un bol.",
      "Añade 1 huevo, 3/4 de taza de leche y 2 cucharadas de mantequilla derretida. Bate bien.",
      "Calienta la sartén a fuego medio con un poco de mantequilla.",
      "Vierte una porción de mezcla y cocina hasta que salgan burbujas. ¡Da la vuelta!",
      "Sirve caliente con miel o manjar. ¡Buen provecho!"
    ]
  },
  {
    id: "arroz",
    title: "🍚 Arroz Blanco Perfecto",
    steps: [
      "Lava 1 taza de arroz hasta que el agua salga clara.",
      "En una olla, calienta un chorrito de aceite y sofreí el arroz con un diente de ajo.",
      "Agrega 2 tazas de agua hirviendo y 1 cucharadita de sal.",
      "Tapa y cocina a fuego bajo por 15 a 20 minutos sin destapar.",
      "Apaga el fuego, deja reposar 5 minutos y sirve."
    ]
  }
];

let currentRecipe = null;
let currentStepIndex = 0;

// Obtener todas las recetas (Por defecto + Creadas mediante fotos)
function getAllRecipes() {
  const customRecipes = JSON.parse(localStorage.getItem('chef_sito_recipes')) || [];
  return [...defaultRecipes, ...customRecipes];
}

window.addEventListener('DOMContentLoaded', () => {
  loadRecipeDropdown();
});

function loadRecipeDropdown(recipesToDisplay = getAllRecipes()) {
  const dropdown = document.getElementById('recipe-dropdown');
  if (!dropdown) return;

  dropdown.innerHTML = '<option value="">-- Elige una receta --</option>';
  recipesToDisplay.forEach(recipe => {
    const option = document.createElement('option');
    option.value = recipe.id;
    option.textContent = recipe.title;
    dropdown.appendChild(option);
  });
}

// Filtro en tiempo real
function filterRecipes() {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;

  const searchTerm = searchInput.value.toLowerCase();
  const all = getAllRecipes();
  const filtered = all.filter(r => r.title.toLowerCase().includes(searchTerm));
  loadRecipeDropdown(filtered);
}

// Lector de Voz por Sintetizador
function speak(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }
}

function startCooking() {
  const dropdown = document.getElementById('recipe-dropdown');
  if (!dropdown) return;

  const selectedId = dropdown.value;
  if (!selectedId) {
    alert("Por favor elige una receta.");
    return;
  }

  currentRecipe = getAllRecipes().find(r => r.id === selectedId);
  if (!currentRecipe) return;

  currentStepIndex = 0;

  document.getElementById('recipe-selector').classList.add('hidden');
  document.getElementById('cooking-panel').classList.remove('hidden');
  document.getElementById('recipe-title').textContent = currentRecipe.title;

  showStep();
}

function showStep() {
  if (!currentRecipe) return;

  const step = currentRecipe.steps[currentStepIndex];
  document.getElementById('step-number').textContent = `Paso ${currentStepIndex + 1} de ${currentRecipe.steps.length}`;
  document.getElementById('step-instruction').textContent = step;

  speak(`Paso ${currentStepIndex + 1}. ${step}`);
}

function nextStep() {
  if (!currentRecipe) return;

  if (currentStepIndex < currentRecipe.steps.length - 1) {
    currentStepIndex++;
    showStep();
  } else {
    speak("¡Felicidades! Has terminado de cocinar esta receta.");
    alert("🎉 ¡Receta completada!");
  }
}

function prevStep() {
  if (currentStepIndex > 0) {
    currentStepIndex--;
    showStep();
  }
}

function resetCooking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  document.getElementById('cooking-panel').classList.add('hidden');
  document.getElementById('recipe-selector').classList.remove('hidden');
}

// --- 📸 PROCESADOR DE IMÁGENES CON INTELIGENCIA ARTIFICIAL ---
async function processUploadedRecipe() {
  const fileInput = document.getElementById('recipe-file-input');
  const status = document.getElementById('upload-status');
  
  if (!fileInput || !fileInput.files[0]) {
    alert("Por favor selecciona una foto de una receta.");
    return;
  }

  // Solicitar clave de API de forma segura la primera vez
  let API_KEY = localStorage.getItem('chef_sito_api_key');

  if (!API_KEY) {
    API_KEY = prompt("Ingresa tu API Key de Google AI Studio:");
    if (API_KEY) {
      localStorage.setItem('chef_sito_api_key', API_KEY.trim());
    } else {
      status.style.color = "#E53E3E";
      status.textContent = "❌ Se requiere una API Key para analizar la foto.";
      return;
    }
  }

  status.style.color = "#4A5568";
  status.textContent = "⏳ Chef-sito está leyendo tu receta...";

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onloadend = async () => {
    try {
      const base64Data = reader.result.split(',')[1];
      const promptText = "Analiza esta foto de una receta de cocina. Extrae el título y los pasos de preparación. Responde ÚNICAMENTE un JSON válido con este formato exacto sin markdown: {\"id\": \"receta-123\", \"title\": \"🍕 Nombre\", \"steps\": [\"paso 1\", \"paso 2\"]}";

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptText },
              { inline_data: { mime_type: file.type || "image/jpeg", data: base64Data } }
            ]
          }]
        })
      });

      if (!response.ok) {
        if (response.status === 400 || response.status === 403) {
          localStorage.removeItem('chef_sito_api_key');
          throw new Error("API Key inválida. Se ha reiniciado, intenta de nuevo.");
        }
        throw new Error(`Error en la solicitud (${response.status})`);
      }

      const data = await response.json();
      const rawText = data.candidates[0].content.parts[0].text;
      
      const cleanJsonText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const newRecipe = JSON.parse(cleanJsonText);

      newRecipe.id = `custom-${Date.now()}`;

      const customRecipes = JSON.parse(localStorage.getItem('chef_sito_recipes')) || [];
      customRecipes.push(newRecipe);
      localStorage.setItem('chef_sito_recipes', JSON.stringify(customRecipes));

      loadRecipeDropdown();
      
      status.style.color = "#38A169";
      status.textContent = `✅ ¡Receta aprendida: ${newRecipe.title}!`;
      alert(`🎉 ¡Chef-sito ha aprendido la nueva receta: ${newRecipe.title}!`);

    } catch (error) {
      console.error(error);
      status.style.color = "#E53E3E";
      status.textContent = `❌ ${error.message || "Error al procesar la foto."}`;
    }
  };

  reader.readAsDataURL(file);
}