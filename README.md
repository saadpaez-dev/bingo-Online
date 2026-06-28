# Bingo Familiar Online 🎉

Una aplicación web completa para jugar al Bingo con familiares y amigos. Un jugador actúa como anfitrión y los demás se unen mediante un código o un enlace compartido por WhatsApp.

## Características
- **Multijugador en tiempo real** (utilizando Firebase Firestore).
- **Dos modos de juego**: Bingo de 75 bolas (tradicional americano) y 90 bolas.
- **Cartones generados dinámicamente** para cada jugador.
- **Botón de ¡Bingo!** con validación automática (evita trampas).
- **Diseño Premium Responsive** (Mode Oscuro y Claro integrados).
- **Sorteo Automático o Manual** con control de tiempos.
- Efectos visuales de confeti para el ganador.

## Requisitos Previos
1. Tener [Node.js](https://nodejs.org/) instalado.
2. Una cuenta en [Firebase](https://firebase.google.com/) (Gratis).

## Instalación y Configuración

### 1. Clonar e Instalar Dependencias
Clona este proyecto o descárgalo y en tu terminal, navega a la carpeta del proyecto y ejecuta:
```bash
npm install
```

### 2. Configurar Firebase
1. Ve a la consola de Firebase y crea un nuevo proyecto.
2. Entra en **Compilación > Base de datos de Firestore**, crea una base de datos y ponla en "Modo de prueba" (o configura reglas de seguridad donde los usuarios anónimos puedan leer y escribir).
3. Entra en **Compilación > Authentication**, ve a "Get Started", luego a "Sign-in method" y habilita **Anónimo** (Anonymous).
4. Ve a la Configuración del Proyecto (icono de engranaje) y en la pestaña "General" baja hasta "Tus apps" y añade una aplicación web (</>). 
5. Copia el objeto `firebaseConfig`.

### 3. Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto (junto a `package.json`) y añade tus credenciales basándote en el `firebaseConfig` obtenido en el paso anterior:
```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu_proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

### 4. Ejecución en Local
Para probarlo en tu computadora:
```bash
npm run dev
```
Abre `http://localhost:5173` en tu navegador.

## Despliegue en Vercel o Netlify
El proyecto está construido con Vite, lo que lo hace perfecto para Vercel o Netlify.
1. Sube tu código a GitHub.
2. Entra en Vercel o Netlify y conecta el repositorio.
3. Asegúrate de configurar las **Variables de Entorno** (las mismas del archivo `.env`) en los ajustes (Settings) del proyecto en Vercel/Netlify.
4. Haz clic en "Deploy".

## Estructura de Carpetas Principal
```text
/src
 ├── /components     # Componentes visuales (BingoCard75, BingoCard90)
 ├── /pages          # Vistas principales (Home, HostPanel, PlayerPanel)
 ├── /utils          # Lógica de juego (bingo.js)
 ├── App.css         # Estilos globales y diseño Vanilla CSS
 ├── App.jsx         # Enrutamiento principal (React Router)
 ├── firebase.js     # Configuración e inicialización de Firebase
 └── main.jsx        # Punto de entrada de React
```
