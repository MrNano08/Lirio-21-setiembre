import * as exifr from 'exifr'

const galleryModules = import.meta.glob('./gallery/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  import: 'default'
})

function formatDate(value){
  if(!(value instanceof Date) || Number.isNaN(value.getTime())) return 'Sin fecha EXIF'
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'long' }).format(value)
}

export async function loadGalleryItems(){
  const entries = Object.entries(galleryModules)
  const items = await Promise.all(entries.map(async ([path, src], index) => {
    let date = null
    try{
      const blob = await fetch(src).then(r => r.blob())
      const meta = await exifr.parse(blob, ['DateTimeOriginal','CreateDate','ModifyDate'])
      date = meta?.DateTimeOriginal || meta?.CreateDate || meta?.ModifyDate || null
    }catch{}
    return {
      id: `gallery-${index + 1}`,
      src,
      title: formatDate(date),
      date: date instanceof Date && !Number.isNaN(date.getTime()) ? date : null,
      filename: path.split('/').pop() || `foto-${index + 1}`,
      alt: `Foto de galería ${index + 1}`
    }
  }))
  items.sort((a,b)=>{
    if(a.date && b.date) return a.date - b.date
    if(a.date) return -1
    if(b.date) return 1
    return a.filename.localeCompare(b.filename)
  })
  return items
}
