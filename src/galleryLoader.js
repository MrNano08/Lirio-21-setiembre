import * as exifr from 'exifr'

const galleryModules = import.meta.glob(
  './gallery/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}',
  {
    eager: true,
    import: 'default'
  }
)

function formatDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return 'Sin fecha'
  }

  return new Intl.DateTimeFormat('es-CR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(value)
}

export async function loadGalleryItems() {
  const entries = Object.entries(galleryModules)

  const items = await Promise.all(
    entries.map(async ([path, src], index) => {
      let date = null

      try {
        const response = await fetch(src)

        if (response.ok) {
          const blob = await response.blob()

          const metadata = await exifr.parse(blob, [
            'DateTimeOriginal',
            'CreateDate',
            'ModifyDate'
          ])

          date =
            metadata?.DateTimeOriginal ||
            metadata?.CreateDate ||
            metadata?.ModifyDate ||
            null
        }
      } catch (error) {
        console.warn(
          `No se pudo leer metadata de ${path}`,
          error
        )
      }

      return {
        id: `gallery-${index + 1}`,
        src,
        title: formatDate(date),
        date:
          date instanceof Date &&
          !Number.isNaN(date.getTime())
            ? date
            : null,
        filename: path.split('/').pop(),
        alt: `Foto de galería ${index + 1}`
      }
    })
  )

  items.sort((a, b) => {
    if (a.date && b.date) {
      return a.date - b.date
    }

    if (a.date) return -1
    if (b.date) return 1

    return a.filename.localeCompare(b.filename)
  })

  return items
}