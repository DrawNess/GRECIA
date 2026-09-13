# Grecia

> Un paseo entre lilas. Un juego en pixel art, hecho ti GRECIA.

Hola, Grecia.

Esto no es un link que se abre y ya. Es un proyecto de verdad, como los que
hago en mi trabajo, y para verlo vas a tener que **levantarlo tú, en tu
computadora**, paso a paso. Así conoces un poquito de lo que hago todos los
días. No necesitas saber nada de programación. Solo seguir el camino.

Tarda unos diez minutos la primera vez. Después, un minuto.

---

## El camino

### Paso 0 · Lo que necesitas

- Una computadora con **Windows 11**.
- Internet (solo para instalar el juego después funciona sin conexión).
- Un rato tranquilo, con auriculares si tienes. El juego tiene sonido.

### Paso 1 · Abre la Terminal

La Terminal es la ventana negra donde los programadores escriben órdenes.
Vas a usarla varias veces, así que conócela desde ahora.

1. Presiona la tecla **Windows**, escribe `Terminal` o 'CMD' y ábrela.
2. Se abre una ventana con un texto que termina en `>`. Ahí se escriben los
   comandos: los escribes tal cual y presionas **Enter**.

### Paso 2 · Instala Node.js

Node.js es el motor que hace funcionar el proyecto. Se instala con un solo
comando. Cópialo en la Terminal y presiona Enter:

```powershell
winget install OpenJS.NodeJS.LTS
```

Si te pregunta si aceptas los términos, escribe `Y` y Enter. Espera a que
diga que se instaló correctamente.

**Importante:** cierra la Terminal y vuelve a abrirla (Paso 1). Si no, no
va a encontrar lo que acabas de instalar.

Para comprobar que quedó bien, escribe:

```powershell
node --version
```

Tiene que responder con un número, algo como `v24.x.x`. Si dice que no
reconoce el comando, mira la sección *Si algo no sale* al final.

### Paso 3 · Permite ejecutar scripts

Windows viene con un candado que impide correr scripts desde la Terminal. Lo
abrimos solo para tu usuario. Este comando es seguro y se hace una sola vez:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force
```

No responde nada si salió bien. Así es la Terminal: cuando no dice nada,
es que todo está bien.

### Paso 4 · Descarga el proyecto

1. Entra a <https://github.com/DrawNess/GRECIA>.
2. Busca el botón verde **Code** y elige **Download ZIP**.
3. Abre la carpeta **Descargas**, haz clic derecho en `GRECIA-main.zip` y
   elige **Extraer todo…**. Deja la ruta que propone y presiona **Extraer**.
4. Te queda una carpeta llamada `GRECIA-main`. Ábrela: adentro tiene que
   haber archivos como `package.json` y una carpeta `src`. Eso es el juego,
   en código. Todo lo que ves en pantalla sale de ahí.

### Paso 5 · Entra a la carpeta desde la Terminal

En la Terminal, escribe esto y Enter (cambia la ruta si extrajiste en otro
lugar):

```powershell
cd "$HOME\Downloads\GRECIA-main\GRECIA-main"
```

Si Windows está en español, la carpeta puede llamarse `Descargas`:

```powershell
cd "$HOME\Descargas\GRECIA-main\GRECIA-main"
```

Para saber si entraste bien, escribe `dir` y Enter: tiene que listar
`package.json` y `src`. Si dice que no encuentra la ruta, en el Explorador
de archivos entra a la carpeta, haz clic derecho en un espacio vacío y elige
**Abrir en Terminal**. Hace lo mismo.

### Paso 6 · Instala las piezas del proyecto

Un proyecto se arma con piezas que otros programadores ya escribieron. Este
comando las descarga (tarda un minuto):

```powershell
npm install
```

Va a mostrar muchas líneas. Es normal. Al final dice algo como
`added 30 packages`. Si aparece la palabra `WARN` en amarillo, no importa.
Si aparece `ERR!` en rojo, mira *Si algo no sale*.

### Paso 7 · Levanta el juego

Este es el momento. Escribe:

```powershell
npm run dev
```

La Terminal se queda "viva" mostrando algo así:

```
  VITE v8.x.x  ready in 300 ms

  ➜  Local:   http://localhost:5173/
```

Eso significa que tu computadora está sirviendo el juego. **No cierres esta
ventana** mientras juegas.

Abre tu navegador (Edge o Chrome) y entra a:

**<http://localhost:5173>**

Presiona **F11** para pantalla completa. Y ahí empieza.

### Paso 8 · Cómo se juega

| Tecla | Qué hace |
|---|---|
| **Flechas** (o W A S D) | caminar |
| **J** | mirar de cerca, sentarse, recoger, romper, pasar el diálogo |
| **↑ ↓** en una charla | elegir tu respuesta, y **J** para confirmar |
| **Shift** (o K) mantenida | correr |
| **Letras** | cuando aparezca una palabra entre los dos, escríbela |
| **M** | silenciar el sonido |

El juego pide tu nombre completo, en mayúsculas. Sabes cuál es.

Algunas cosas te van a mandar de vuelta al inicio. No es un error. Es parte
del camino. Otra vez, con calma.

Y una pista, solo una: **lo que recojas, llévalo hasta el final.**

### Paso 9 · Para cerrar, y para volver a jugar

- Para cerrar: en la Terminal presiona **Ctrl + C** (te pregunta si estás
  segura, escribe `S` o `Y` y Enter), y cierra la ventana.
- Para volver a jugar otro día: abre la Terminal, repite el **Paso 5** y el
  **Paso 7**. Solo eso. Lo demás ya quedó instalado.

---

## Si algo no sale

**"node no se reconoce como un comando"** · No cerraste y volviste a abrir la
Terminal después de instalar Node. Ciérrala, ábrela y prueba de nuevo. Si
sigue igual, instala Node desde <https://nodejs.org> (botón LTS), con todo
por defecto, y reinicia la computadora.

**"npm.ps1 no se puede cargar porque la ejecución de scripts está
deshabilitada"** · Te saltaste el Paso 3. Ejecútalo y vuelve a intentar.

**"winget no se reconoce"** · Abre Microsoft Store, busca *Instalador de
aplicación* y actualízalo. O instala Node desde <https://nodejs.org>.

**"No se encuentra la ruta"** al hacer `cd` · La carpeta se llama distinto o
está en otro lugar. Usa el truco de **Abrir en Terminal** del Paso 5.

**El navegador dice que no puede conectarse** · La Terminal del Paso 7 tiene
que seguir abierta y mostrando `Local: http://localhost:5173/`. Si muestra
otro número (por ejemplo `5174`), usa ese.

**Se ve muy pequeño** · Presiona F11 en el navegador. Y juega en la
computadora, no en el celular: está hecho para teclado.

**Si necesitas navegar en carpetas** 
cd NombreCarpeta *Para entrar a una carpeta*
cd .. *Para salir de una carpeta*
dir *Para listar carpetas*


**Cualquier otra cosa** · Escríbeme. Para eso estoy.
