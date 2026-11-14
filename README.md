# 🧠 ReelMind — AI Video Vault (PWA)

> Tu segundo cerebro y bóveda inteligente para guardar, resumir y organizar trucos, prompts y herramientas de IA desde **TikTok**, **Instagram Reels** y **YouTube Shorts**.

---

## ✨ Características Principales

* ⚡ **Cero fricción para guardar:** Pega un enlace con un solo toque desde el portapapeles o comparte directamente desde el menú nativo del móvil con la **PWA (Web Share Target)**.
* 🎬 **Dos apartados especializados (Reels vs Vídeos Largos):**
  * **📱 Reels (< 10 min):** Para TikTok, Instagram Reels y YouTube Shorts. Descarga audio ligero optimizado (48kbps) y Gemini realiza un análisis multimodal a fondo (pasos, prompts y herramientas).
  * **🎬 Vídeos (> 10 min):** Para cursos, charlas y tutoriales largos de YouTube. **Sin descarga de archivos multimedia** a disco: guarda el enlace directo, extrae metadatos y genera un resumen conciso con **mínimo consumo de tokens** (~500 tokens de texto).
* 📁 **Carpetas & Subcarpetas Jerárquicas:**
  * Organiza tus vídeos por áreas (ej: *💻 Programación & Web* ➔ *🤖 Agentes Autónomos* o *⚡ Full-Stack & Prototipos*).
  * Personaliza cada carpeta con iconos/emojis (`💻`, `🎨`, `⚡`, `🤖`, `🎬`, etc.) y colores de acento.
  * Vista de *Inbox / Sin clasificar* para archivar después.
  * Mueve vídeos entre carpetas con 1 clic desde la tarjeta o el modal de detalle.
* 🤖 **Comprensión multimodal con Gemini 2.5 Flash:** Descarga el audio en segundo plano mediante `yt-dlp` y Gemini analiza el contenido directamente con inferencia asíncrona no bloqueante (`client.aio`).
* 🎨 **Motor Multi-Tema Interactivo (7 Diseños Profesionales):**
  * **Claude:** Estética editorial cálida, terracota suave y tipografía Newsreader Serif.
  * **Gemini:** Azul cósmico espacial, geometría limpia y estética cuántica moderna.
  * **ChatGPT:** Carbón neutro minimalista, contraste equilibrado y verde esmeralda icónico.
  * **OpenClaw:** Negro táctico de alto impacto con acentos carmesí neón.
  * **Hermes Agent:** Consola de ciber-inteligencia, acentos cobre ardiente y tipografía monospace.
  * **Vercel / v0:** Negro OLED absoluto, líneas hiperprecisas y azul cobalto.
  * **Midjourney:** Púrpura noche espacial, atmósfera inmersiva y destellos lavanda.

* 📦 **Exportación para Obsidian & Markdown:**
  * **Exportación individual:** Descarga cualquier ficha en `.md` con metadatos YAML Frontmatter, resumen, herramientas, pasos y bloques de código.
  * **Bóveda completa en .ZIP:** Exporta toda la biblioteca organizada en las mismas carpetas jerárquicas con archivo `Indice_Boveda.md` con enlaces internos `[[wikilinks]]` para importar directamente en tu bóveda de Obsidian en Mac (`/Users/wacko87/Desktop/Proyectos Antigravity/Antigravity/`).

* ⚡ **Bóveda de Prompts Dedicada (Cheatsheet):**
  * Vista rápida que agrupa y extrae todos los prompts de tus reels y vídeos categorizados por herramienta (Midjourney, Flux, Claude, ChatGPT, etc.).
  * Búsqueda instantánea y copia en 1 clic.

* 🪄 **Optimizador de Prompts & Adaptador de Motores con IA:**
  * Genera 3 variaciones creativas o adapta el prompt a la sintaxis y fortalezas técnicas de **Midjourney v6.1**, **Flux 1.1 Pro**, **DALL-E 3** o **Claude / ChatGPT**.

* 🔍 **"Preguntar a tu Bóveda" (Asistente RAG con Gemini 2.5 Flash):**
  * Consulta en lenguaje natural cualquier duda técnica sobre tus vídeos guardados ("¿Qué trucos tengo para consistencia de personajes?", "¿Qué herramientas hay para clonar voces?").
  * Gemini sintetiza la respuesta citando y enlazando las fichas exactas de tu biblioteca.

* ⏱️ **Filtro de Tiempo Estimado para Probar:**
  * Clasificación automática por Gemini en `⚡ < 5 min`, `⏱️ 15-30 min` o `⏳ > 1 hora`.
  * Filtros interactivos en cabecera e insignias visuales en cada ficha.

* 🔖 **Bookmarklet 1-Click para Navegadores en Mac (Safari / Chrome / Arc):**
  * Botón arrastrable a la barra de marcadores para guardar cualquier reel o vídeo con 1 solo clic mientras navegas en el ordenador.

* 🤝 **Detección Amigable de Duplicados:**
  * Si introduces un enlace ya existente, ReelMind te informa cordialmente en qué carpeta se encuentra y cuándo se guardó, con un botón directo para abrir su ficha.
* 🛡️ **Seguridad Homelab & Blindaje Anti-Hacking:**
  * **Protección por PIN / Contraseña:** Pantalla de bloqueo integrada (`AUTH_PIN`) para exponer tu app en internet de forma segura.
  * **Defensa Anti-SSRF:** Bloqueo estricto de direcciones locales (`192.168.x.x`, `127.0.0.1`, `localhost`) y lista blanca de dominios admitidos (TikTok, Instagram, YouTube, X).
  * **Protección DoS:** Límite máximo de duración (10 min) y tamaño (50MB) para evitar saturación de CPU y disco.
  * **Sanitización XSS:** Enlaces externos estrictamente restringidos al protocolo `https://`.
* 📱 **PWA Nativa:** Instálala en iOS (Safari -> Compartir -> Añadir a pantalla de inicio) o Android (Chrome -> Instalar app) como una app independiente con tema oscuro y soporte táctil.
* 🐳 **100% Self-Hosted & Dockerizado:** Un solo contenedor ligero con backend FastAPI, SQLite en modo WAL montado en `/mnt/cache` y frontend Vite integrado.

---

## 🚀 Inicio Rápido en Local (Mac)

1. **Configurar tu clave de Gemini y PIN (opcional):**
   Copia `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
   * Puedes definir `AUTH_PIN=1234` si quieres proteger la app con contraseña.
   * Si dejas `AUTH_PIN` vacío, el acceso es libre en tu red local.

2. **Ejecutar con el script de desarrollo:**
   ```bash
   ./dev.sh
   ```
   * Frontend: `http://localhost:5173`
   * Backend API: `http://localhost:8000`

---

## 🐳 Despliegue en Unraid

El proyecto incluye un script de despliegue automatizado para tu servidor Unraid (`192.168.7.160`):

```bash
./deploy-unraid.sh
```

### Configuración en Nginx Proxy Manager (NPM):
1. Accede a tu panel de Nginx Proxy Manager.
2. Añade un nuevo **Proxy Host**:
   * **Domain Names:** `reels.wacko87.es` (o `reelmind.wacko87.es`)
   * **Scheme:** `http`
   * **Forward Hostname / IP:** `192.168.7.160`
   * **Forward Port:** `8085`
   * **Websockets Support:** Activar
   * **Block Common Exploits:** Activar
3. En la pestaña **SSL**:
   * Selecciona tu certificado Let's Encrypt `*.wacko87.es`.
   * Marca *Force SSL* y *HTTP/2 Support*.

---

## 📱 Cómo usar la PWA en tu Móvil

1. Abre `https://reels.wacko87.es` en Safari (iPhone) o Chrome (Android).
2. Toca en **Compartir** -> **"Añadir a la pantalla de inicio"** (o "Instalar aplicación").
3. ¡Listo! Tendrás el icono de ReelMind en tu móvil como cualquier otra app nativa.
4. Cuando veas un vídeo en TikTok o Instagram:
   * **Opción A (Ultra rápida):** Dale a *Copiar enlace*, abre ReelMind y dale al botón *"Pegar enlace"*.
   * **Opción B (Share Target):** Dale a *Compartir en...* -> Selecciona **ReelMind** en la lista de apps.
