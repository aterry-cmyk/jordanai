'use client';
import { useState, useEffect } from 'react';

interface Cfg { companyName:string; loName:string; vapiApiKey:string; vapiPhoneNumberId:string; assistantIdEn:string; assistantIdEs:string; }

export default function VapiSettings() {
  const [cfg, setCfg] = useState<Cfg>({ companyName:'Dream Key Lending Group', loName:'Juan', vapiApiKey:'', vapiPhoneNumberId:'', assistantIdEn:'', assistantIdEs:'' });
  const [saving, setSaving] = useState(false);
  const [init, setInit] = useState<Record<string,string>>({ en:'idle', es:'idle' });
  const [msg, setMsg] = useState<string|null>(null);

  useEffect(() => { try { const s = localStorage.getItem('vapi_cfg'); if(s) setCfg(JSON.parse(s)); } catch{} }, []);

  const set = (k: keyof Cfg, v: string) => setCfg(p => ({...p,[k]:v}));
  const save = async () => { setSaving(true); localStorage.setItem('vapi_cfg', JSON.stringify(cfg)); await new Promise(r=>setTimeout(r,400)); setSaving(false); setMsg('Saved.'); setTimeout(()=>setMsg(null),3000); };

  const initAsst = async (lang: string) => {
    setInit(p=>({...p,[lang]:'loading'}));
    try {
      const existingId = lang === 'en' ? cfg.assistantIdEn : cfg.assistantIdEs;
      const r = await fetch('/api/vapi/assistant', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ language:lang, vapiAssistantId: existingId || undefined }) });
      const d = await r.json();
      if(!r.ok) throw new Error(d.error||'Failed');
      const nc = {...cfg};
      if(lang==='en') nc.assistantIdEn=d.assistantId; else nc.assistantIdEs=d.assistantId;
      setCfg(nc); localStorage.setItem('vapi_cfg', JSON.stringify(nc));
      setInit(p=>({...p,[lang]:'done'}));
    } catch(e:any) { setInit(p=>({...p,[lang]:'error'})); setMsg(`Error: ${e.message}`); }
  };

  const s: Record<string,React.CSSProperties> = {
    wrap: { display:'flex', flexDirection:'column', gap:16 },
    panel: { background:'var(--surface,#0D1320)', border:'1px solid var(--border,rgba(255,255,255,0.06))', borderRadius:10, padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 },
    title: { fontSize:13, fontWeight:600, color:'var(--text,#F0F4FF)', marginBottom:4 },
    row: { display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 },
    label: { fontSize:13, color:'var(--text,#F0F4FF)', fontWeight:500 },
    desc: { fontSize:11, color:'var(--text3,#5A6480)', marginTop:2 },
    input: { width:'100%', padding:'7px 10px', background:'var(--surface2,#111926)', border:'1px solid var(--border2,rgba(255,255,255,0.1))', borderRadius:6, color:'var(--text,#F0F4FF)', fontSize:12, fontFamily:'monospace', outline:'none', boxSizing:'border-box' as const },
    arow: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border,rgba(255,255,255,0.06))' },
    ibtn: { padding:'7px 16px', borderRadius:7, border:'1px solid rgba(0,229,160,0.3)', background:'rgba(0,229,160,0.1)', color:'#00E5A0', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
    env: { background:'rgba(255,149,0,0.06)', border:'1px solid rgba(255,149,0,0.2)', borderRadius:8, padding:'14px 16px' },
    code: { fontFamily:'monospace', fontSize:11, color:'var(--text,#F0F4FF)', background:'rgba(0,0,0,0.2)', padding:'8px 10px', borderRadius:5, whiteSpace:'pre' as const, lineHeight:1.7 },
    save: { padding:'9px 24px', borderRadius:8, border:'none', background:'rgba(0,229,160,0.15)', color:'#00E5A0', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  };

  const Input = ({k, ph, t='text'}: {k:keyof Cfg, ph:string, t?:string}) => (
    <input type={t} value={cfg[k]} onChange={e=>set(k,e.target.value)} placeholder={ph} style={s.input} />
  );

  return (
    <div style={s.wrap}>
      <div style={s.panel}>
        <div style={s.title}>Identity</div>
        <div style={s.row}><div><div style={s.label}>Company Name</div><div style={s.desc}>How the AI identifies your company on calls</div></div><div style={{flex:1,maxWidth:260}}><Input k="companyName" ph="Dream Key Lending Group"/></div></div>
        <div style={s.row}><div><div style={s.label}>Loan Officer Name</div><div style={s.desc}>The AI calls on behalf of this person</div></div><div style={{flex:1,maxWidth:260}}><Input k="loName" ph="Juan"/></div></div>
      </div>
      <div style={s.panel}>
        <div style={s.title}>Vapi Credentials</div>
        <div style={s.row}><div><div style={s.label}>API Key</div><div style={s.desc}>vapi.ai → Dashboard → API Keys</div></div><div style={{flex:1,maxWidth:260}}><Input k="vapiApiKey" ph="vapi_..." t="password"/></div></div>
        <div style={s.row}><div><div style={s.label}>Phone Number ID</div><div style={s.desc}>vapi.ai → Phone Numbers → click number → copy ID</div></div><div style={{flex:1,maxWidth:260}}><Input k="vapiPhoneNumberId" ph="pn_..."/></div></div>
      </div>
      <div style={s.panel}>
        <div style={s.title}>AI Assistants</div>
        {(['en','es'] as const).map(lang => (
          <div key={lang} style={s.arow}>
            <div>
              <div style={s.label}>{lang==='en'?'🇺🇸 English':'🇪🇸 Spanish'} Assistant</div>
              <div style={s.desc}>{(lang==='en'?cfg.assistantIdEn:cfg.assistantIdEs)||'Not initialized'}</div>
            </div>
            <button onClick={()=>initAsst(lang)} disabled={init[lang]==='loading'} style={s.ibtn}>
              {init[lang]==='loading'?'...' : init[lang]==='done'?'✓ Updated' : init[lang]==='error'?'Retry' : (lang==='en'?cfg.assistantIdEn:cfg.assistantIdEs)?'Update':'Initialize'}
            </button>
          </div>
        ))}
      </div>
      <div style={s.env}>
        <div style={{fontSize:12,fontWeight:600,color:'#FF9500',marginBottom:8}}>⚠️ Add to Vercel Environment Variables</div>
        <div style={s.code}>{`VAPI_API_KEY=${cfg.vapiApiKey||'your-key'}\nVAPI_PHONE_NUMBER_ID=${cfg.vapiPhoneNumberId||'pn_...'}\nCOMPANY_NAME=${cfg.companyName}\nLO_NAME=${cfg.loName}`}</div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:12,justifyContent:'flex-end'}}>
        {msg && <div style={{fontSize:12,color:'#00E5A0'}}>{msg}</div>}
        <button onClick={save} disabled={saving} style={s.save}>{saving?'Saving...':'Save Settings'}</button>
      </div>
    </div>
  );
}
