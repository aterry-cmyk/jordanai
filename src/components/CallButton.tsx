'use client';
import { useState, useEffect } from 'react';

interface Props { leadId: string; leadName: string; leadPhone: string; leadLanguage?: string; attemptCount?: number; lastCalledAt?: string; }

export default function CallButton({ leadId, leadName, leadPhone, leadLanguage = 'en', attemptCount = 0, lastCalledAt }: Props) {
  const [status, setStatus] = useState<'idle'|'calling'|'active'|'ended'|'error'>('idle');
  const [lang, setLang] = useState<'en'|'es'>(leadLanguage as 'en'|'es');
  const [callId, setCallId] = useState<string|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [disp, setDisp] = useState<string|null>(null);

  useEffect(() => { let t: any; if (status === 'active') t = setInterval(() => setElapsed(e => e+1), 1000); return () => clearInterval(t); }, [status]);
  useEffect(() => {
    let t: any;
    if (status === 'active' && callId) t = setInterval(async () => { try { const r = await fetch(`/api/vapi/call?vapiCallId=${callId}`).then(r=>r.json()); if (r.status==='ended') { setStatus('ended'); setDisp(r.analysis?.structuredData?.disposition||null); clearInterval(t); } } catch{} }, 3000);
    return () => clearInterval(t);
  }, [status, callId]);

  const fmt = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const COLORS: Record<string,string> = { HOT:'#00E5A0', APPOINTMENT_SET:'#00E5A0', WARM:'#FF9500', COLD:'#8B95B0', PREP_CANDIDATE:'#0066FF', DEAD:'#FF4444', NO_ANSWER:'#8B95B0' };

  const call = async () => {
    setStatus('calling'); setError(null); setElapsed(0); setDisp(null);
    try {
      const r = await fetch('/api/vapi/call', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ leadId, forceLanguage: lang }) });
      const d = await r.json();
      if (!r.ok) { setStatus('error'); setError(d.error||'Call failed'); return; }
      setCallId(d.callId); setStatus('active');
    } catch (e: any) { setStatus('error'); setError(e.message); }
  };

  const s: Record<string,React.CSSProperties> = {
    wrap: { display:'flex', flexDirection:'column', gap:8 },
    toggle: { display:'flex', gap:4 },
    lb: { padding:'3px 10px', borderRadius:5, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'#8B95B0', fontSize:11, fontWeight:600, cursor:'pointer' },
    lba: { background:'rgba(0,229,160,0.12)', borderColor:'rgba(0,229,160,0.3)', color:'#00E5A0' },
    btn: { display:'flex', alignItems:'center', gap:8, padding:'9px 18px', borderRadius:8, border:'none', background:'rgba(0,229,160,0.15)', color:'#00E5A0', fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
    badge: { padding:'2px 7px', borderRadius:4, fontSize:10, fontWeight:700, background:'rgba(0,229,160,0.2)', color:'#00E5A0' },
    hint: { fontSize:11, color:'#5A6480' },
    phone: { fontSize:11, color:'#5A6480', fontFamily:'monospace' },
    err: { fontSize:12, color:'#FF4444', padding:'6px 10px', background:'rgba(255,68,68,0.08)', borderRadius:6 },
  };

  return (
    <div style={s.wrap}>
      <div style={s.toggle}>
        {(['en','es'] as const).map(l => <button key={l} onClick={() => setLang(l)} disabled={status==='active'||status==='calling'} style={{...s.lb,...(lang===l?s.lba:{})}}>{l.toUpperCase()}</button>)}
      </div>
      {(status==='idle'||status==='error') && <button onClick={call} style={s.btn}>📞 Call {leadName.split(' ')[0]}{attemptCount>0&&<span style={s.badge}>#{attemptCount+1}</span>}</button>}
      {status==='calling' && <button disabled style={{...s.btn, background:'rgba(255,149,0,0.12)', color:'#FF9500'}}>⏳ Initiating...</button>}
      {status==='active' && <button disabled style={{...s.btn, background:'rgba(255,68,68,0.12)', color:'#FF4444'}}>🔴 Live — {fmt(elapsed)}</button>}
      {status==='ended' && <button onClick={call} style={{...s.btn, background:'rgba(255,255,255,0.06)', color:'#8B95B0'}}>Call again {disp&&<span style={{...s.badge, background:COLORS[disp]||'#555', color:'#000'}}>{disp}</span>}</button>}
      {error && <div style={s.err}>{error}</div>}
      {attemptCount>0 && lastCalledAt && status==='idle' && <div style={s.hint}>Last called {new Date(lastCalledAt).toLocaleDateString()} · {attemptCount} attempt{attemptCount!==1?'s':''}</div>}
      <div style={s.phone}>{leadPhone}</div>
    </div>
  );
}
