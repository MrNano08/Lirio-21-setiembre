# Donde vive la luz — lirio 3D con seis recuerdos

Proyecto React + Vite + Three.js. Esta versión SÍ es 3D real: puedes girar alrededor de la flor, verla desde arriba o abajo y acercarte. Los pétalos tienen superficies cerradas, grosor y normales suavizadas. El acabado combina colores mates, variaciones de pigmento, iluminación suave y destellos. Es una interpretación original inspirada en las referencias visuales, no una copia de sus modelos o materiales.

El jardín ahora también tiene un entorno ligero alrededor del lirio: terreno ondulado, parche de tierra, piedras, 420 briznas de pasto instanciadas, pequeñas flores, árboles de fondo, colinas simplificadas, niebla atmosférica y un cielo envolvente. Los elementos lejanos funcionan como profundidad visual de bajo costo para no depender de modelos 3D pesados ni texturas externas.

Requiere Node.js 22.12 o superior compatible con Vite 7 y un navegador con WebGL2 y aceleración gráfica. No requiere claves, cuentas, servidores de fotos, modelos remotos ni fuentes externas. Internet solo se necesita para instalar paquetes.

Descomprime en una carpeta nueva para no mezclar con la versión 2D anterior.

## Ejecutar

```bash
npm i
npm run dev
```

Abre la dirección que Vite muestra en la terminal (normalmente `http://localhost:5173`).

No abras index.html haciendo doble clic. Para detener el servidor usa Ctrl+C.

## Agregar tus fotos y textos (sin modificar el código 3D)

1. Copia tus fotos dentro de **public/fotos**. Ejemplo: foto-1.jpg.
2. Abre **src/recuerdos.js**.
3. Cambia los campos de cada recuerdo. Mantén los IDs del 1 al 6.

```js
{
  id: 1,
  titulo: 'Nuestro primer viaje',
  foto: 'fotos/foto-1.jpg',
  alt: 'Una descripción de la fotografía',
  texto: `Aquí escribes tu mensaje.

También puedes agregar más párrafos.`,
},
```

La ruta no lleva public/. Respeta mayúsculas, minúsculas y extensión del archivo.
Si foto está vacía, aparece el espacio reservado. Si la ruta está mal, aparece un aviso en la tarjeta en lugar de una imagen rota. Las fotos se muestran completas, sin recortarlas. Puedes usar JPG, PNG o WebP; imágenes de hasta 1600 px de ancho suelen ser suficientes.

Guarda los cambios: el servidor de desarrollo actualizará la página. En una versión publicada tendrás que volver a generar el build. Tus cambios en los archivos permanecen; el contador de recuerdos abiertos solo dura mientras la página esté abierta.

## Crear versión final

```bash
npm run build
npm run preview
```

## Interacciones

- Arrastra con el mouse o un dedo para girar la cámara alrededor de la flor.
- Rueda del mouse o gesto de pinza para acercar/alejar.
- Cada luz está unida a la punta de su pétalo. Tócala para abrir su foto y texto.
- Arrastrar no debe abrir una tarjeta por accidente.
- Los seis botones numerados permiten abrir todos los recuerdos también con teclado, o si una luz queda detrás de la flor.
- La tarjeta se cierra con ×, Escape o al tocar fuera. Las flechas recorren los recuerdos.
- Vista inicial restablece la cámara. Pausar brisa detiene el movimiento ambiental sin impedir girar manualmente.
- Se respeta la preferencia del sistema de reducir movimiento.

## Archivos principales

- src/recuerdos.js: tus seis fotos y textos.
- public/fotos/: tus imágenes.
- src/FlowerScene.jsx: escena y comportamiento 3D.
- src/petalGeometry.js: geometría suave de los pétalos.
- src/main.jsx: interfaz y tarjetas.
- src/styles.css: diseño adaptable.

## Verificación

```bash
npm test
npm run build
```

Las pruebas verifican seis recuerdos, coordenadas y normales válidas, grosor, continuidad de superficies y orientación. La compilación se comprobó durante la entrega y la silueta se revisó mediante un render de geometría. El render final WebGL y la interacción completa en navegador no pudieron validarse en el entorno de creación. Si el navegador no puede crear el contexto 3D, se muestra un aviso y siguen disponibles las tarjetas mediante los botones.

Si aparece el aviso de WebGL2, revisa la aceleración gráfica del navegador y los controladores gráficos, o prueba otro navegador compatible.


## Entorno y assets externos

- El bosque de fondo usa tres modelos GLB de **Quaternius – Stylized Nature MegaKit**, publicados bajo **CC0 1.0**.
- Los modelos se cargan por jsDelivr desde copias optimizadas para web del repositorio `anshaneja5/skyline-run`.
- Si los modelos externos no pueden descargarse, la escena crea automáticamente un bosque procedural de respaldo.
- El pasto usa `InstancedMesh` y un shader de vértices para simular una brisa suave sin animar cientos de objetos individualmente.
- Se eliminaron las piedras decorativas del entorno.

Fuente/licencia de árboles: https://github.com/anshaneja5/skyline-run/blob/main/CREDITS.md
