import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import FlowerScene from './FlowerScene'
import { recuerdos } from './recuerdos'
import { loadGalleryItems } from './galleryLoader'
import './styles.css'

function Star({className=''}){return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 1C13 8.5 15.5 11 23 12C15.5 13 13 15.5 12 23C11 15.5 8.5 13 1 12C8.5 11 11 8.5 12 1Z" fill="currentColor"/></svg>}
function Photo({memory}){
  const [failed,setFailed]=useState(false)
  const source = memory.foto
  ? /^https?:\/\//i.test(memory.foto)
    ? memory.foto
    : `${import.meta.env.BASE_URL}${memory.foto.replace(/^\//, '')}`
  : ''
  if(source&&!failed)return <img className="memory-photo" src={source} alt={memory.alt||memory.titulo} onError={()=>setFailed(true)}/>
  return <div className="photo-placeholder"><div className="placeholder-halo"/><Star/><svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="7" y="7" width="34" height="34" rx="4" stroke="currentColor"/><circle cx="30" cy="18" r="4" stroke="currentColor"/><path d="M8 34L19 23L29 34L35 28L41 34" stroke="currentColor"/></svg><span>{failed?'No se pudo cargar la foto':'Aquí florecerá tu foto'}</span><small>{failed?'Revisa la ruta en src/recuerdos.js':'Un espacio reservado para ti'}</small></div>
}
function MemoryDialog({memory,onClose,onChange,availableIds}){
  const dialog=useRef(null)
  useEffect(()=>{dialog.current.showModal()},[])
  const index=availableIds.indexOf(memory.id)
  const prevId=index>0?availableIds[index-1]:null
  const nextId=index>=0&&index<availableIds.length-1?availableIds[index+1]:null
  return <dialog ref={dialog} className="memory-dialog" aria-labelledby="memory-title" onClose={onClose} onClick={e=>{if(e.target===dialog.current){const r=dialog.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose()}}}>
    <button className="close" autoFocus onClick={onClose} aria-label="Cerrar recuerdo">×</button>
    <Photo key={memory.id+memory.foto} memory={memory}/>
    <div className="memory-copy"><span className="overline">PÉTALO {String(memory.id).padStart(2,'0')} · UN RECUERDO</span><h2 id="memory-title">{memory.titulo}</h2><p>{memory.texto}</p><nav className="memory-nav" aria-label="Recorrer recuerdos"><button onClick={()=>prevId&&onChange(prevId)} aria-label="Recuerdo anterior" disabled={!prevId}>←</button><span>{memory.id} / 6</span><button onClick={()=>nextId&&onChange(nextId)} aria-label="Recuerdo siguiente" disabled={!nextId}>→</button></nav></div>
  </dialog>
}
function GalleryDialog({items,index,onClose,onChange}){
  const dialog=useRef(null)
  useEffect(()=>{dialog.current.showModal()},[])
  const item=items[index]
  const prev=index>0?index-1:null
  const next=index<items.length-1?index+1:null
  return <dialog ref={dialog} className="memory-dialog gallery-dialog" aria-labelledby="gallery-title" onClose={onClose} onClick={e=>{if(e.target===dialog.current){const r=dialog.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose()}}}>
    <button className="close" autoFocus onClick={onClose} aria-label="Cerrar galería">×</button>
    {item?<img className="memory-photo" src={item.src} alt={item.alt||item.filename}/>:<div className="photo-placeholder gallery-empty"><div className="placeholder-halo"/><Star/><span>Coloca tus fotos en src/gallery</span><small>Cuando agregues imágenes y ejecutes npm run dev o npm run build, aparecerán aquí.</small></div>}
    <div className="memory-copy"><span className="overline">GALERÍA CENTRAL</span><h2 id="gallery-title">{item?item.title:'Galería vacía'}</h2><nav className="memory-nav" aria-label="Recorrer fotos"><button onClick={()=>prev!==null&&onChange(prev)} aria-label="Foto anterior" disabled={prev===null}>←</button><span>{items.length?`${index+1} / ${items.length}`:'0 / 0'}</span><button onClick={()=>next!==null&&onChange(next)} aria-label="Foto siguiente" disabled={next===null}>→</button></nav></div>
  </dialog>
}
const defaultDebug = { exposure:1.0, sun:2.45, ambient:2.2, bloom:0.45, grass:1.0, shadows:0.35 }

function App(){
  const [selected,setSelected]=useState(null),[focusMemoryId,setFocusMemoryId]=useState(null),[galleryOpen,setGalleryOpen]=useState(false),[galleryIndex,setGalleryIndex]=useState(0),[galleryItems,setGalleryItems]=useState([]),[visited,setVisited]=useState(new Set()),[paused,setPaused]=useState(false),[resetKey,setResetKey]=useState(0),[status,setStatus]=useState('loading'),[reducedMotion,setReducedMotion]=useState(false)
  const lastFocus=useRef(null)
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReducedMotion(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[])
  useEffect(()=>{loadGalleryItems().then(setGalleryItems).catch(()=>setGalleryItems([]))},[])
  const galleryUnlocked = visited.size===6
  const nextMemoryId=recuerdos.find(m=>!visited.has(m.id))?.id ?? null
  const availableIds=recuerdos.filter(m=>visited.has(m.id)||m.id===nextMemoryId).map(m=>m.id)
  const canOpen = useCallback(id=>{
    if(id==='gallery') return galleryUnlocked
    return visited.has(id)||id===nextMemoryId
  },[visited,nextMemoryId,galleryUnlocked])
  const select=useCallback(id=>{
    if(id==null||!canOpen(id))return
    setSelected(null)
    setGalleryOpen(false)
    if(id==='gallery') setGalleryIndex(0)
    setFocusMemoryId(id)
  },[canOpen])
  const handleFocusComplete=useCallback(id=>{
    setFocusMemoryId(current=>current===id?null:current)
    if(id==='gallery'){
      setGalleryOpen(true)
      return
    }
    setVisited(prev=>new Set([...prev,id]))
    setSelected(id)
  },[])
  const handleStatus=useCallback(value=>setStatus(value),[])
  const close=useCallback(()=>{setSelected(null);setGalleryOpen(false);lastFocus.current?.focus()},[])
  const memory=recuerdos.find(m=>m.id===selected)
  return <main>
    <div className="paper-grain" aria-hidden="true"/>
    <header className="masthead"><span className="brand"><Star/>un pequeño jardín</span><span className="edition">SEIS PÉTALOS · SEIS RECUERDOS</span></header>
    <section className="intro"><p>Hay recuerdos que florecen.<br/>Toca una luz y descubre uno .</p><div className="intro-detail"><span/> Un lirio, un pequeño universo.</div></section>
    <FlowerScene onSelect={select} onFocusComplete={handleFocusComplete} onStatus={handleStatus} paused={paused} modalOpen={!!memory||galleryOpen} visited={visited} galleryUnlocked={galleryUnlocked} focusMemoryId={focusMemoryId} nextMemoryId={nextMemoryId} resetKey={resetKey} reducedMotion={reducedMotion} debug={defaultDebug}/>
    {status==='loading'&&<div className="scene-message" role="status"><Star/> El jardín está despertando…</div>}
    {(status==='unsupported'||status==='lost')&&<div className="scene-message error" role="alert"><Star/><strong>No se pudo mostrar el jardín 3D.</strong><p>Necesita WebGL2 y aceleración gráfica. Prueba con un navegador compatible. Mientras tanto, puedes abrir tus recuerdos con los seis botones.</p></div>}
    <section className="memory-picker" aria-label="Abrir recuerdos"><span className="overline">SIGUE EL ORDEN DE LA LUZ</span><div className="memory-buttons">{recuerdos.map(m=>{const unlocked=canOpen(m.id),seen=visited.has(m.id);return <button key={m.id} className={`${seen?'seen':''} ${!unlocked?'locked':''}`.trim()} aria-label={`Abrir ${m.titulo}`} onClick={e=>{lastFocus.current=e.currentTarget;select(m.id)}} disabled={!unlocked||focusMemoryId!==null}><Star/><span>{String(m.id).padStart(2,'0')}</span></button>})}{galleryUnlocked&&<button className="gallery-shortcut" aria-label="Abrir galería central" onClick={e=>{lastFocus.current=e.currentTarget;select('gallery')}} disabled={focusMemoryId!==null}><Star/><span>G</span></button>}</div><span className="visited" aria-live="polite">{visited.size===6?'6 de 6 recuerdos descubiertos · la luz del centro abre la galería':`${visited.size} de 6 recuerdos descubiertos · ahora sigue el pétalo ${String(nextMemoryId).padStart(2,'0')}`}</span></section>
    <div className="scene-toolbar"><button onClick={()=>setResetKey(k=>k+1)} aria-label="Restablecer la vista de la flor">↺ <span>Vista inicial</span></button><button onClick={()=>setPaused(v=>!v)} aria-pressed={paused} disabled={reducedMotion}>{paused?'▷':'Ⅱ'} <span>{reducedMotion?'Movimiento reducido':paused?'Reanudar brisa':'Pausar brisa'}</span></button></div>
    <footer><span>Hecho de luz y pequeñas historias.</span><span className="gesture"><svg width="20" height="15" viewBox="0 0 20 15" fill="none" aria-hidden="true"><path d="M2 7.5H18M5 4L1.5 7.5L5 11M15 4L18.5 7.5L15 11" stroke="currentColor"/></svg>Arrastra para girar · Acerca con dos dedos o la rueda</span></footer>
    {memory&&<MemoryDialog memory={memory} onClose={close} onChange={select} availableIds={availableIds}/>}
    {galleryOpen&&<GalleryDialog items={galleryItems} index={galleryIndex} onClose={close} onChange={setGalleryIndex}/>}
  </main>
}
createRoot(document.getElementById('root')).render(<App/> )
