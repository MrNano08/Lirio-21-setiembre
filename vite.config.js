import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import fs from 'node:fs/promises'
import path from 'node:path'

import * as exifr from 'exifr'


const VIRTUAL_ID = 'virtual:gallery-manifest'
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_ID

const GALLERY_DIR = path.resolve(
  process.cwd(),
  'src/gallery'
)

const IMAGE_REGEX =
  /\.(jpg|jpeg|png|webp)$/i


/*
 * ==============================
 * BUSCAR FOTOS
 * ==============================
 */

async function getGalleryFiles(dir) {
  try {
    const entries = await fs.readdir(
      dir,
      {
        withFileTypes: true
      }
    )

    const files = []

    for (const entry of entries) {
      const absolutePath =
        path.join(
          dir,
          entry.name
        )

      if (entry.isDirectory()) {
        const children =
          await getGalleryFiles(
            absolutePath
          )

        files.push(...children)
      }

      else if (
        entry.isFile() &&
        IMAGE_REGEX.test(
          entry.name
        )
      ) {
        files.push(
          absolutePath
        )
      }
    }

    return files.sort(
      (a, b) =>
        a.localeCompare(b)
    )
  }

  catch (error) {
    console.error(
      'No se pudo leer src/gallery:',
      error
    )

    return []
  }
}


/*
 * ==============================
 * VALIDACIÓN DE FECHAS
 * ==============================
 */

function isReasonablePhotoDate(date) {
  if (
    !(date instanceof Date) ||
    Number.isNaN(
      date.getTime()
    )
  ) {
    return false
  }

  const year =
    date.getFullYear()

  const currentYear =
    new Date()
      .getFullYear()

  /*
   * Evita cosas como:
   *
   * 1790
   * 1904
   * 2098
   *
   * Para esta galería suponemos
   * fotografías modernas.
   */
  return (
    year >= 2000 &&
    year <= currentYear + 1
  )
}


/*
 * Evita que JavaScript convierta:
 *
 * 2025-13-40
 *
 * en otra fecha automáticamente.
 */
function createValidatedDate(
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0
) {
  year = Number(year)
  month = Number(month)
  day = Number(day)
  hour = Number(hour)
  minute = Number(minute)
  second = Number(second)

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second)
  ) {
    return null
  }

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null
  }

  const date = new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  )

  /*
   * Verificar que JS no haya
   * corregido automáticamente
   * una fecha inválida.
   */
  if (
    date.getFullYear() !== year ||
    date.getMonth() !==
      month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return null
  }

  return isReasonablePhotoDate(
    date
  )
    ? date
    : null
}


/*
 * ==============================
 * NORMALIZAR FECHA EXIF
 * ==============================
 */

function normalizeDate(value) {
  if (!value) {
    return null
  }


  /*
   * exifr normalmente devuelve
   * Date directamente.
   */
  if (
    value instanceof Date
  ) {
    return isReasonablePhotoDate(
      value
    )
      ? value
      : null
  }


  /*
   * Timestamp numérico.
   */
  if (
    typeof value === 'number'
  ) {
    const date =
      new Date(value)

    return isReasonablePhotoDate(
      date
    )
      ? date
      : null
  }


  if (
    typeof value !== 'string'
  ) {
    return null
  }


  const clean =
    value.trim()


  /*
   * Formato EXIF típico:
   *
   * 2025:05:04 11:11:26
   */
  const exifMatch =
    clean.match(
      /^(\d{4}):(\d{2}):(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/
    )

  if (exifMatch) {
    const [
      ,
      year,
      month,
      day,
      hour = '00',
      minute = '00',
      second = '00'
    ] = exifMatch

    return createValidatedDate(
      year,
      month,
      day,
      hour,
      minute,
      second
    )
  }


  /*
   * Formato ISO:
   *
   * 2025-05-04
   * 2025-05-04T11:11:26
   */
  const isoMatch =
    clean.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/
    )

  if (isoMatch) {
    const [
      ,
      year,
      month,
      day,
      hour = '00',
      minute = '00',
      second = '00'
    ] = isoMatch

    return createValidatedDate(
      year,
      month,
      day,
      hour,
      minute,
      second
    )
  }


  return null
}


/*
 * ==============================
 * FECHA DESDE EL NOMBRE
 * ==============================
 *
 * Ejemplos soportados:
 *
 * IMG_20250504_111126.jpg
 * IMG-20250504-111126.jpg
 * 20250504_111126.jpg
 * 2025-05-04_11-11-26.jpg
 */

function dateFromFilename(
  filename
) {
  /*
   * Formato:
   * 20250504_111126
   */
  let match =
    filename.match(
      /(\d{4})(\d{2})(\d{2})[_-]?(\d{2})?(\d{2})?(\d{2})?/
    )

  if (match) {
    const [
      ,
      year,
      month,
      day,
      hour = '00',
      minute = '00',
      second = '00'
    ] = match

    const date =
      createValidatedDate(
        year,
        month,
        day,
        hour,
        minute,
        second
      )

    if (date) {
      return date
    }
  }


  /*
   * Formato:
   * 2025-05-04_11-11-26
   */
  match =
    filename.match(
      /(\d{4})[-_](\d{2})[-_](\d{2})(?:[_\s-](\d{2})[-_.](\d{2})(?:[-_.](\d{2}))?)?/
    )

  if (match) {
    const [
      ,
      year,
      month,
      day,
      hour = '00',
      minute = '00',
      second = '00'
    ] = match

    return createValidatedDate(
      year,
      month,
      day,
      hour,
      minute,
      second
    )
  }


  return null
}


/*
 * ==============================
 * LEER EXIF
 * ==============================
 */

async function readPhotoDate(
  absolutePath
) {
  let date = null
  let source = 'sin fecha'

  try {
    /*
     * Esto ocurre SOLO durante:
     *
     * npm run dev
     * npm run build
     *
     * NO en el celular.
     */
    const buffer =
      await fs.readFile(
        absolutePath
      )


    /*
     * Solo pedimos campos que pueden
     * representar la fecha real de
     * creación de la fotografía.
     *
     * NO usamos:
     *
     * ModifyDate
     * MetadataDate
     * FileModifyDate
     *
     * porque pueden corresponder a
     * ediciones o modificaciones.
     */
    const metadata =
      await exifr.parse(
        buffer,
        [
          'DateTimeOriginal',
          'CreateDate',
          'DateTimeDigitized',
          'DateCreated'
        ]
      )


    if (metadata) {
      /*
       * Orden de prioridad.
       */
      const candidates = [
        {
          name:
            'DateTimeOriginal',
          value:
            metadata
              .DateTimeOriginal
        },

        {
          name:
            'CreateDate',
          value:
            metadata
              .CreateDate
        },

        {
          name:
            'DateTimeDigitized',
          value:
            metadata
              .DateTimeDigitized
        },

        {
          name:
            'DateCreated',
          value:
            metadata
              .DateCreated
        }
      ]


      /*
       * Si una fecha da 1790,
       * se descarta y seguimos
       * probando la siguiente.
       */
      for (
        const candidate
        of candidates
      ) {
        const normalized =
          normalizeDate(
            candidate.value
          )

        if (normalized) {
          date =
            normalized

          source =
            candidate.name

          break
        }
      }
    }
  }

  catch (error) {
    console.warn(
      `No se pudo leer metadata de ${path.basename(
        absolutePath
      )}:`,
      error.message
    )
  }


  /*
   * Si EXIF no sirve,
   * usamos el nombre.
   */
  if (!date) {
    const filenameDate =
      dateFromFilename(
        path.basename(
          absolutePath
        )
      )

    if (filenameDate) {
      date =
        filenameDate

      source =
        'nombre del archivo'
    }
  }


  return {
    date,
    source
  }
}


/*
 * ==============================
 * FORMATO VISUAL
 * ==============================
 */

function formatDate(date) {
  if (!date) {
    return 'Sin fecha'
  }

  return new Intl.DateTimeFormat(
    'es-CR',
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }
  ).format(date)
}


/*
 * ==============================
 * PLUGIN DE VITE
 * ==============================
 */

function galleryManifestPlugin() {
  return {
    name:
      'gallery-manifest',


    resolveId(id) {
      if (
        id === VIRTUAL_ID
      ) {
        return (
          RESOLVED_VIRTUAL_ID
        )
      }

      return null
    },


    async load(id) {
      if (
        id !==
        RESOLVED_VIRTUAL_ID
      ) {
        return null
      }


      const files =
        await getGalleryFiles(
          GALLERY_DIR
        )


      console.log(
        '\n=============================='
      )

      console.log(
        `GALERÍA: ${files.length} fotos`
      )

      console.log(
        '==============================\n'
      )


      const photos = []


      /*
       * Leer metadata una vez
       * durante el build.
       */
      for (
        const absolutePath
        of files
      ) {
        const relativePath =
          path
            .relative(
              GALLERY_DIR,
              absolutePath
            )
            .split(
              path.sep
            )
            .join('/')


        const filename =
          path.basename(
            absolutePath
          )


        const {
          date,
          source
        } =
          await readPhotoDate(
            absolutePath
          )


        const formattedDate =
          formatDate(date)


        console.log(
          `[GALERÍA] ${filename}`
        )

        console.log(
          `          ${formattedDate}`
        )

        console.log(
          `          Fuente: ${source}`
        )


        photos.push({
          relativePath,
          filename,

          title:
            formattedDate,

          timestamp:
            date
              ? date.getTime()
              : null
        })
      }


      /*
       * ==============================
       * ORDEN CRONOLÓGICO
       * ==============================
       */

      photos.sort(
        (a, b) => {
          if (
            a.timestamp !== null &&
            b.timestamp !== null
          ) {
            return (
              a.timestamp -
              b.timestamp
            )
          }


          if (
            a.timestamp !== null
          ) {
            return -1
          }


          if (
            b.timestamp !== null
          ) {
            return 1
          }


          return (
            a.filename
              .localeCompare(
                b.filename
              )
          )
        }
      )


      /*
       * ==============================
       * IMPORTAR URLs
       * ==============================
       *
       * Esto hace que Vite copie las
       * imágenes a dist/assets.
       *
       * NO hace que el navegador
       * descargue todas las imágenes.
       */

      const imports =
        photos
          .map(
            (
              photo,
              index
            ) => {
              const importPath =
                `/src/gallery/${photo.relativePath}?url`

              return `
import galleryPhoto${index} from ${JSON.stringify(
                importPath
              )}
`
            }
          )
          .join('\n')


      /*
       * ==============================
       * MANIFIESTO
       * ==============================
       */

      const items =
        photos
          .map(
            (
              photo,
              index
            ) => {
              return `
{
  id: ${JSON.stringify(
    `gallery-${index + 1}`
  )},

  src: galleryPhoto${index},

  title: ${JSON.stringify(
    photo.title
  )},

  filename: ${JSON.stringify(
    photo.filename
  )},

  timestamp: ${
    photo.timestamp === null
      ? 'null'
      : photo.timestamp
  },

  alt: ${JSON.stringify(
    `Foto de galería ${
      index + 1
    }`
  )}
}
`
            }
          )
          .join(',\n')


      return `
${imports}

export default [
  ${items}
]
`
    }
  }
}


/*
 * ==============================
 * VITE
 * ==============================
 */

export default defineConfig({
  base: '/',

  plugins: [
    react(),
    galleryManifestPlugin()
  ],

  build: {
    /*
     * Evita que Vite convierta
     * imágenes pequeñas a Base64
     * dentro del JS.
     */
    assetsInlineLimit: 0
  }
})