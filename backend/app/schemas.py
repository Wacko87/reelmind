from pydantic import BaseModel, Field
from typing import List, Optional, Union

class LoginRequest(BaseModel):
    pin: str = Field(..., description="PIN o contraseña de acceso configurada")
    username: Optional[str] = Field(None, description="Nombre de usuario opcional")

class LoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    message: Optional[str] = None
    username: Optional[str] = None
    is_admin: Optional[bool] = False

class AuthStatusResponse(BaseModel):
    auth_required: bool
    is_authenticated: bool
    username: Optional[str] = None
    user_id: Optional[str] = None
    is_admin: Optional[bool] = False

class UserCreate(BaseModel):
    username: str = Field(..., min_length=2, max_length=50, description="Nombre de usuario único")
    pin: str = Field(..., min_length=4, max_length=32, description="PIN o contraseña de acceso")
    is_admin: Optional[bool] = Field(False, description="¿Tiene permisos de administrador?")

class UserResponse(BaseModel):
    id: str
    username: str
    is_admin: bool
    created_at: str
    reel_count: int = 0

class FolderCreate(BaseModel):
    name: str = Field(..., description="Nombre de la carpeta o subcarpeta")
    parent_id: Optional[str] = Field(None, description="ID de la carpeta padre si es una subcarpeta")
    icon: Optional[str] = Field("📁", description="Emoji o icono de la carpeta")
    color: Optional[str] = Field("#8b5cf6", description="Color representativo")

class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None

class FolderItem(BaseModel):
    id: str
    name: str
    parent_id: Optional[str] = None
    icon: str
    color: str
    reel_count: int = 0
    total_reel_count: int = 0
    children: List['FolderItem'] = []
    created_at: str
    updated_at: str

FolderItem.model_rebuild()

class ReelAnalyzeRequest(BaseModel):
    url: str = Field(..., description="URL del vídeo o imagen (TikTok, Instagram Reel/Post, YouTube, X/Twitter, infografía directa, data URL)")
    folder_id: Optional[str] = Field(None, description="ID de la carpeta donde guardarlo")
    media_type: Optional[str] = Field("auto", description="'auto' (determina según duración o formato), 'reel', 'video' o 'image'")

class GeminiAnalysisResult(BaseModel):
    title: str = Field(..., description="Título atractivo y conciso de qué trata el truco o herramienta de IA explicada")
    summary: str = Field(..., description="Resumen ejecutivo claro en 2 o 3 oraciones de qué se logra y por qué es útil")
    ai_tools: List[str] = Field(default_factory=list, description="Lista de herramientas, plataformas o modelos de IA mencionados")
    key_steps: List[str] = Field(default_factory=list, description="Lista ordenada de pasos prácticos para replicar lo que muestra el vídeo")
    prompts: List[str] = Field(default_factory=list, description="Prompts o instrucciones textuales exactas")
    tags: List[str] = Field(default_factory=list, description="Etiquetas temáticas cortas en minúsculas")
    difficulty: str = Field(default="Intermedio", description="Nivel: Principiante, Intermedio o Avanzado")
    estimated_time: str = Field(default="15-30 min", description="Tiempo estimado para probar: '< 5 min', '15-30 min', o '> 1 hora'")

class ReelResponse(BaseModel):
    id: str
    url: str
    platform: str
    author: Optional[str] = None
    author_url: Optional[str] = None
    original_title: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration: Optional[Union[int, float]] = 0
    title: str
    summary: str
    ai_tools: List[str]
    key_steps: List[str]
    prompts: List[str]
    tags: List[str]
    difficulty: str
    estimated_time: Optional[str] = "15-30 min"
    status: str  # 'pending', 'tested', 'favorite'
    user_notes: str
    folder_id: Optional[str] = None
    folder_name: Optional[str] = None
    media_type: str = "reel"  # 'reel' (<10 min), 'video' (>10 min) o 'image' (infografía/cheatsheet)
    images: List[str] = Field(default_factory=list, description="Lista de imágenes si es un carrusel o infografía múltiple")
    is_duplicate: bool = False
    created_at: str
    updated_at: str

class ReelUpdateRequest(BaseModel):
    status: Optional[str] = None
    user_notes: Optional[str] = None
    title: Optional[str] = None
    tags: Optional[List[str]] = None
    folder_id: Optional[str] = None
    media_type: Optional[str] = None
    estimated_time: Optional[str] = None

class PromptVariation(BaseModel):
    label: str = Field(..., description="Estilo o motor (ej: 'Midjourney v6.1', 'Flux 1.1 Pro', 'Fotográfico cinematográfico')")
    prompt: str = Field(..., description="Texto del prompt optimizado o variado")
    explanation: Optional[str] = Field(None, description="Breve apunte técnico de los cambios introducidos")

class PromptOptimizeRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=4000, description="Prompt a optimizar o variar")
    mode: str = Field(default="variations", max_length=50, description="'variations' (3 estilos creativos) o 'adapt_model'")
    target_model: Optional[str] = Field(None, max_length=100, description="Modelo destino (Midjourney, Flux, DALL-E 3, Claude / ChatGPT, etc.)")

class PromptOptimizeResponse(BaseModel):
    original_prompt: str
    mode: str
    target_model: Optional[str] = None
    variations: List[PromptVariation]

class VaultCitation(BaseModel):
    reel_id: str
    title: str
    platform: str
    tools: List[str] = []

class VaultAskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1500, description="Pregunta del usuario en lenguaje natural sobre su colección de trucos y herramientas")

class VaultAskResponse(BaseModel):
    answer: str
    citations: List[VaultCitation] = []

class AppSettingsSchema(BaseModel):
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None
