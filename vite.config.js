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

    return files
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
 * Convierte distintos formatos
 * de fecha a Date.
 */
function normalizeDate(value) {
  if (!value) {
    return null
  }

  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {
    return value
  }


  if (typeof value === 'number') {
    const date =
      new Date(value)

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date
  }


  if (
    typeof value === 'string'
  ) {
    /*
     * Formato EXIF:
     *
     * 2025:05:04 11:11:26
     */
    const exifMatch =
      value.match(
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

      const date =
        new Date(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hour),
          Number(minute),
          Number(second)
        )

      return Number.isNaN(
        date.getTime()
      )
        ? null
        : date
    }


    /*
     * ISO y otros formatos.
     */
    const date =
      new Date(value)

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return date
    }
  }

  return null
}


/*
 * Busca recursivamente fechas
 * dentro de EXIF, XMP e IPTC.
 */
function findMetadataDate(metadata) {
  if (!metadata) {
    return null
  }

  const preferredKeys = [
    'DateTimeOriginal',
    'CreateDate',
    'DateTimeDigitized',
    'DateCreated',
    'ModifyDate',
    'MetadataDate',
    'DateTime'
  ]


  /*
   * Primero buscamos los nombres
   * más confiables.
   */
  for (
    const key of preferredKeys
  ) {
    if (
      Object.prototype
        .hasOwnProperty.call(
          metadata,
          key
        )
    ) {
      const date =
        normalizeDate(
          metadata[key]
        )

      if (date) {
        return date
      }
    }
  }


  /*
   * Algunas fechas de XMP/IPTC
   * vienen dentro de objetos.
   */
  for (
    const value of
    Object.values(metadata)
  ) {
    if (
      value &&
      typeof value === 'object' &&
      !(value instanceof Date) &&
      !Array.isArray(value)
    ) {
      const nested =
        findMetadataDate(
          value
        )

      if (nested) {
        return nested
      }
    }
  }


  return null
}


/*
 * Último recurso:
 *
 * IMG_20250504_111126.jpg
 *
 * se interpreta como:
 *
 * 4 mayo 2025 11:11:26
 */
function dateFromFilename(
  filename
) {
  const match =
    filename.match(
      /(?:IMG[_-]?)?(\d{4})(\d{2})(\d{2})[_-]?(\d{2})?(\d{2})?(\d{2})?/i
    )

  if (!match) {
    return null
  }

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
    new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    )


  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date
}


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


async function readPhotoDate(
  absolutePath
) {
  let date = null
  let source = 'sin fecha'

  try {
    /*
     * IMPORTANTE:
     *
     * Aquí se lee la metadata
     * durante npm run build.
     *
     * Esto NO ocurre en el celular.
     */
    const metadata =
      await exifr.parse(
        absolutePath,
        {
          tiff: true,

          ifd0: true,

          exif: true,

          /*
           * Algunas aplicaciones
           * guardan la fecha aquí.
           */
          xmp: true,
          iptc: true,

          gps: false,
          interop: false,
          ifd1: false,

          makerNote: false,
          userComment: false,

          translateKeys: true,
          translateValues: true,
          reviveValues: true,

          mergeOutput: true,

          /*
           * En Node exifr puede leer
           * solo los fragmentos
           * necesarios del archivo.
           */
          chunked: true
        }
      )


    date =
      findMetadataDate(
        metadata
      )


    if (date) {
      source = 'EXIF/XMP'
    }
  }

  catch (error) {
    console.warn(
      `No se pudo leer metadata de ${path.basename(
        absolutePath
      )}`,
      error
    )
  }


  /*
   * Si WhatsApp, una edición,
   * una descarga, etc. borró el
   * EXIF, intentamos obtener la
   * fecha del nombre.
   */
  if (!date) {
    date =
      dateFromFilename(
        path.basename(
          absolutePath
        )
      )

    if (date) {
      source =
        'nombre de archivo'
    }
  }


  return {
    date,
    source
  }
}


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
        `\n🌻 Galería: ${files.length} fotos encontradas\n`
      )


      const photos = []


      /*
       * Lo hacemos una por una.
       *
       * Esto ocurre SOLO
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


        /*
         * Esto te permite verificar
         * las fechas directamente
         * desde npm run build.
         */
        console.log(
          `[galería] ${filename} -> ${
            date
              ? formatDate(date)
              : 'SIN FECHA'
          } (${source})`
        )


        photos.push({
          absolutePath,
          relativePath,
          filename,

          title:
            formatDate(date),

          timestamp:
            date
              ? date.getTime()
              : null
        })
      }


      /*
       * Orden cronológico.
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
       * Cada import genera
       * solamente la URL final
       * del asset.
       *
       * NO mete los JPG dentro
       * del JavaScript.
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
import galleryPhoto${index}
from ${JSON.stringify(
                importPath
              )};
              `
            }
          )
          .join('\n')


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
    photo.timestamp ??
    'null'
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


export default defineConfig({
  base: '/',

  plugins: [
    react(),
    galleryManifestPlugin()
  ],

  build: {
    /*
     * Muy importante:
     *
     * Las fotos siempre quedan
     * como archivos separados.
     */
    assetsInlineLimit: 0
  }
})