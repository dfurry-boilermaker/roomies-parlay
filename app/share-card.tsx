'use client';
import { useEffect, useRef, useState } from 'react';
import { Share2, Sparkles } from 'lucide-react';
import { names, type Week } from '@/lib/league';
import { cardBackground } from '@/lib/card-background';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => { img.src = ''; reject(Error('Images took too long. Try again.')); }, 25000);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(Error('Could not load the artwork. Try again.')); };
    img.src = src;
  });
}

// Wrap by measured width, including long unbroken pick text. Never trim away the line.
function linesFor(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const lines: string[] = []; let line = '';
  for (const char of text) {
    if (ctx.measureText(line + char).width > max && line) { lines.push(line); line = ''; }
    line += char;
  }
  if (line) lines.push(line);
  return lines;
}

async function renderCard(week: Week): Promise<File> {
  const background = cardBackground(week.date);
  const art = await loadImage(background.src);
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1350;
  const c = canvas.getContext('2d');
  if (!c) throw Error('Your browser could not create the card.');
  const accent = background.accent;
  const cover = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale, sh = h / scale;
    c.drawImage(img, (img.width-sw)/2, (img.height-sh)/2, sw, sh, x, y, w, h);
  };
  cover(art, 0, 0, 1080, 1350);
  const veil = c.createLinearGradient(0, 0, 0, 1350);
  veil.addColorStop(0, '#09051d15'); veil.addColorStop(.4, '#09051d22'); veil.addColorStop(1, '#09051d66');
  c.fillStyle = veil; c.fillRect(0, 0, 1080, 1350);
  c.save(); c.translate(66, 94); c.rotate(-.035);
  c.fillStyle = accent; c.fillRect(0, 0, 484, 48);
  c.fillStyle = '#100a23'; c.font = '900 26px Arial'; c.fillText('ROOMIES PARLAY / WEEKLY DROP', 15, 33); c.restore();
  c.fillStyle = '#fff'; c.strokeStyle = '#170922'; c.lineWidth = 9;
  c.font = '900 105px Arial'; c.strokeText('SATURDAY', 59, 249); c.fillText('SATURDAY', 59, 249);
  c.fillStyle = accent; c.strokeText('CHAOS.', 59, 351); c.fillText('CHAOS.', 59, 351);
  c.font = '700 25px Arial'; c.fillStyle = '#fff';
  const date = new Date(week.date + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  c.fillText(date.toUpperCase(), 66, 415);
  c.textAlign = 'right'; c.fillStyle = accent;
  c.fillText(`${week.picks.filter(p => p.text.trim()).length}/5 PICKS IN`, 1014, 415); c.textAlign = 'left';
  week.picks.forEach((pick, i) => {
    const y = 454 + i * 153;
    c.save(); c.translate(540, y+67); c.rotate(i % 2 ? .008 : -.008);
    c.fillStyle = '#0f1125d9'; c.fillRect(-474,-67,948,134);
    c.fillStyle = accent; c.fillRect(-474,-67,6,134);
    c.globalAlpha = .12; c.font = '900 110px Arial'; c.fillText(`0${i+1}`, 319,37); c.globalAlpha = 1;
    c.fillStyle = accent; c.font = '800 22px Arial'; c.fillText(names[i].toUpperCase(), -450,-33);
    const text = pick.text.trim() || 'Awaiting pick';
    let size = 34; let lines: string[] = [];
    do { c.font = `800 ${size}px Arial`; lines = linesFor(c, text, 805); if(lines.length<=2) break; size-=2; } while(size>18);
    c.fillStyle = pick.text.trim() ? '#fff' : '#b4b2c6';
    lines.forEach((line,j) => c.fillText(line, -450, 8+j*(size+5)));
    c.restore();
  });
  const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(Error('Could not create the image.')), 'image/png'));
  return new File([blob], `roomies-parlay-${week.date}.png`, {type:'image/png'});
}

export default function ShareCard({week}: {week: Week}) {
  const [file,setFile] = useState<File>();
  const [url,setUrl] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const generation = useRef(0);
  const signature = JSON.stringify(week);
  useEffect(() => { generation.current++; setFile(undefined); setUrl(''); setBusy(false); },[signature]);
  useEffect(() => () => { if(url) URL.revokeObjectURL(url); },[url]);
  useEffect(() => () => { generation.current++; },[]);
  async function generate() {
    const run = ++generation.current;
    setBusy(true); setError(''); setFile(undefined); setUrl('');
    try {
      const result = await renderCard(week);
      if(run !== generation.current) return;
      setFile(result); setUrl(URL.createObjectURL(result));
    } catch(e) { if(run===generation.current) setError((e as Error).message); }
    finally { if(run===generation.current) setBusy(false); }
  }
  async function share() {
    if(!file) return;
    setError('');
    try {
      if(navigator.canShare?.({files:[file]})) {
        await navigator.share({files:[file],title:'Roomies Parlay'});
      } else {
        setError('Image sharing is unavailable in this browser. On iPhone, open in Safari or touch and hold the image to share it.');
      }
    } catch(e) { if((e as Error).name !== 'AbortError') setError('Sharing did not open. Try again, or touch and hold the image.'); }
  }
  return <section className="share-card-panel" aria-label="Generate weekly card">
    <button onClick={generate} disabled={busy || !week.picks.some(p=>p.text.trim())} type="button"><Sparkles size={18}/>{busy ? 'Mixing this week’s chaos…' : 'Generate this week’s card'}</button>
    {busy && <p role="status" className="collage-status">Blending the artwork and adding your picks…</p>}
    {url && <><img className="share-card-canvas collage-preview" src={url} alt="This week’s Roomies Parlay collage with all five picks"/><div className="share-card-actions"><button onClick={share} type="button"><Share2 size={18}/>Share</button></div></>}
    {error && <p role="status" className="collage-status">{error}</p>}
  </section>;
}
