'use client'
import { useEffect, useState, useRef, useCallback } from 'react'

// ── TYPES ─────────────────────────────────────────────────────────
type Lead = {
  id: string; first_name: string; last_name: string; phone: string; email: string
  zip_code: string; loan_amount: string; source: string; language: string; notes: string
  credit_score: string; income: string; down_payment: string; looking_to_buy: string
  timeline: string; interest_level: string; lead_rating: number
  stage: string; temperature: string; ai_analysis: string; next_action: string
  called_count: number; last_called: string; created_at: string
}
type Call = {
  id: string; lead_id: string; status: string; duration: number
  recording_url: string; ai_summary: string; ai_rating: number; temperature: string
  transcript: string; disposition: string; duration_seconds: number
  created_at: string; vapi_call_id: string
}
type Script = { id: string; name: string; script: string; lead_type: string; is_default: boolean }
type Note   = { id: string; title: string; content: string; category: string }
type Voice  = { id: string; name: string; lang: string }
type Msg    = { role: 'user' | 'assistant'; content: string; agent?: string }

// ── STYLES ────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  app:        { display:'flex', height:'100vh', fontFamily:'Arial,sans-serif', background:'#0c1220', color:'#e8edf5', overflow:'hidden' },
  sidebar:    { width:200, background:'#111827', borderRight:'1px solid rgba(255,255,255,.08)', display:'flex', flexDirection:'column', flexShrink:0 },
  logo:       { padding:'18px 16px 14px', fontSize:18, fontWeight:700, borderBottom:'1px solid rgba(255,255,255,.08)' },
  navItem:    { display:'flex', alignItems:'center', gap:9, padding:'9px 14px', margin:'1px 6px', borderRadius:8, cursor:'pointer', fontSize:13, color:'#94a3b8' },
  navActive:  { background:'rgba(59,130,246,.12)', color:'#60a5fa', fontWeight:700 },
  main:       { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
  topbar:     { height:54, borderBottom:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', padding:'0 20px', gap:12, background:'#111827', flexShrink:0 },
  content:    { flex:1, overflowY:'auto', padding:20 },
  card:       { background:'#111827', border:'1px solid rgba(255,255,255,.08)', borderRadius:10, padding:18 },
  cardTitle:  { fontSize:14, fontWeight:700, marginBottom:14 },
  grid2:      { display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 },
  grid3:      { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 },
  grid4:      { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 },
  statBox:    { background:'#111827', border:'1px solid rgba(255,255,255,.08)', borderRadius:10, padding:16 },
  statLabel:  { fontSize:11, color:'#4b6080', textTransform:'uppercase' as const, letterSpacing:.5, marginBottom:6 },
  statVal:    { fontSize:24, fontWeight:700 },
  tbl:        { width:'100%', borderCollapse:'collapse' as const },
  th:         { textAlign:'left' as const, padding:'9px 12px', fontSize:11, color:'#4b6080', fontWeight:700, textTransform:'uppercase' as const, borderBottom:'1px solid rgba(255,255,255,.08)', background:'#1a2540' },
  td:         { padding:'11px 12px', fontSize:13, borderBottom:'1px solid rgba(255,255,255,.08)', verticalAlign:'middle' as const },
  input:      { background:'#1a2540', border:'1px solid rgba(255,255,255,.14)', borderRadius:7, color:'#e8edf5', padding:'8px 11px', fontSize:13, fontFamily:'Arial,sans-serif', outline:'none', width:'100%', boxSizing:'border-box' as const },
  select:     { background:'#1a2540', border:'1px solid rgba(255,255,255,.14)', borderRadius:7, color:'#e8edf5', padding:'7px 10px', fontSize:13, fontFamily:'Arial,sans-serif', outline:'none' },
  label:      { display:'block', fontSize:12, color:'#94a3b8', marginBottom:5 },
  btnPrimary: { padding:'8px 16px', background:'#3b82f6', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Arial,sans-serif' },
  btnOutline: { padding:'7px 14px', background:'transparent', border:'1px solid rgba(255,255,255,.14)', borderRadius:8, color:'#94a3b8', fontSize:12, cursor:'pointer', fontFamily:'Arial,sans-serif' },
  btnSm:      { padding:'5px 11px', fontSize:12 },
  btnDanger:  { padding:'5px 11px', background:'#ef4444', border:'none', borderRadius:7, color:'#fff', fontSize:12, cursor:'pointer', fontFamily:'Arial,sans-serif' },
  btnSuccess: { padding:'5px 11px', background:'#22c55e', border:'none', borderRadius:7, color:'#fff', fontSize:12, cursor:'pointer', fontFamily:'Arial,sans-serif' },
  modalBg:    { position:'fixed' as const, inset:0, background:'rgba(0,0,0,.65)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' },
  modal:      { background:'#111827', border:'1px solid rgba(255,255,255,.14)', borderRadius:12, padding:24, maxHeight:'85vh', overflowY:'auto' as const },
  modalHead:  { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 },
  modalTitle: { fontSize:16, fontWeight:700 },
  closeBtn:   { background:'none', border:'none', color:'#4b6080', fontSize:22, cursor:'pointer', lineHeight:'1' },
  field:      { marginBottom:13 },
  fieldRow:   { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  msgRow:     { display:'flex', gap:9 },
  msgAv:      { width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 },
  bubAgent:   { maxWidth:'78%', padding:'9px 13px', borderRadius:10, fontSize:13, lineHeight:1.55, background:'#1a2540', border:'1px solid rgba(255,255,255,.14)', color:'#94a3b8', whiteSpace:'pre-wrap' as const },
  bubUser:    { maxWidth:'78%', padding:'9px 13px', borderRadius:10, fontSize:13, lineHeight:1.55, background:'#3b82f6', color:'#fff', whiteSpace:'pre-wrap' as const },
}

const STAGE_PILLS: Record<string, { label: string; bg: string; color: string }> = {
  new_lead:        { label:'New Lead',     bg:'rgba(59,130,246,.15)',  color:'#60a5fa' },
  contacted:       { label:'Contacted',    bg:'rgba(34,197,94,.15)',   color:'#22c55e' },
  appointment_set: { label:'Appt. Set',    bg:'rgba(245,158,11,.15)', color:'#f59e0b' },
  doc_request:     { label:'Doc Request',  bg:'rgba(239,68,68,.15)',  color:'#ef4444' },
  pre_approved:    { label:'Pre-Approved', bg:'rgba(34,197,94,.15)',  color:'#22c55e' },
  closed_won:      { label:'Closed Won',   bg:'rgba(34,197,94,.2)',   color:'#22c55e' },
  closed_lost:     { label:'Closed Lost',  bg:'rgba(255,255,255,.06)', color:'#94a3b8' },
}
const TEMP_COLOR: Record<string, string> = { hot:'#ef4444', warm:'#f59e0b', cold:'#60a5fa', not_interested:'#94a3b8' }
const STAGES = ['new_lead','contacted','appointment_set','doc_request','pre_approved','closed_won']

// ── MAIN COMPONENT ────────────────────────────────────────────────
export default function App() {
  const [view,    setView]    = useState('dashboard')
  const [leads,   setLeads]   = useState<Lead[]>([])
  const [calls,   setCalls]   = useState<Call[]>([])
  const [voices,  setVoices]  = useState<Voice[]>([])
  const [scripts, setScripts] = useState<Script[]>([])
  const [notes,   setNotes]   = useState<Note[]>([])
  const [theme,   setTheme]   = useState('#3b82f6')

  // Call prefs
  const [selVoice,  setSelVoice]  = useState('')
  const [selScript, setSelScript] = useState('')

  // UI state
  const [search,     setSearch]     = useState('')
  const [briefing,   setBriefing]   = useState('')
  const [calling,    setCalling]    = useState<string | null>(null)
  const [selLead,    setSelLead]    = useState<Lead | null>(null)
  const [leadCalls,  setLeadCalls]  = useState<Call[]>([])

  // Filters
  const [filterStage, setFilterStage] = useState('')
  const [filterTemp,  setFilterTemp]  = useState('')
  const [filterLang,  setFilterLang]  = useState('')
  const [sortBy,      setSortBy]      = useState('created_at')

  // Bulk select
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set())
  const [showBulkEdit,  setShowBulkEdit]  = useState(false)
  const [bulkStage,     setBulkStage]     = useState('')
  const [bulkTemp,      setBulkTemp]      = useState('')
  const [bulkLang,      setBulkLang]      = useState('')
  const [bulkApplying,  setBulkApplying]  = useState(false)

  // Modals
  const [showImport,   setShowImport]   = useState(false)
  const [showScript,   setShowScript]   = useState(false)
  const [showNote,     setShowNote]     = useState(false)
  const [showSMS,      setShowSMS]      = useState<Lead|null>(null)
  const [showEmail,    setShowEmail]    = useState<Lead|null>(null)
  const [showVoicemail,setShowVoicemail]= useState<Lead|null>(null)
  const [confirmDelete,setConfirmDelete]= useState<Lead|null>(null)

  // Import
  const [importTab, setImportTab] = useState<'single'|'csv'>('single')
  const [importSrc, setImportSrc] = useState('Manual')
  const [impF, setImpF] = useState({ first_name:'', last_name:'', phone:'', email:'', zip_code:'', loan_amount:'', language:'en', notes:'' })
  const [csvRows, setCsvRows] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Quick compose
  const [smsText,       setSmsText]       = useState('')
  const [emailSubject,  setEmailSubject]  = useState('')
  const [emailBody,     setEmailBody]     = useState('')
  const [vmScript,      setVmScript]      = useState('')
  const [sendingAction, setSendingAction] = useState(false)

  // Script form
  const [sForm, setSForm] = useState({ name:'', script:'', lead_type:'general', is_default:false })

  // Note form
  const [nForm, setNForm] = useState({ title:'', content:'', category:'general' })

  // Settings
  const [cfg, setCfg] = useState<Record<string,string>>({})
  const [cfgInputs, setCfgInputs] = useState<Record<string,string>>({})

  // Chat
  const [agent,    setAgent]    = useState<'sales_manager'|'caller'>('sales_manager')
  const [msgs,     setMsgs]     = useState<Msg[]>([{ role:'assistant', content:"Good morning. Pipeline loaded. What do you need from me?", agent:'Sales Manager' }])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatHistory, setChatHistory] = useState<{role:string;content:string}[]>([])
  const [meetingTab, setMeetingTab] = useState<'chat'|'training'>('chat')
  const msgsRef = useRef<HTMLDivElement>(null)

  // Toast
  const [toasts, setToasts] = useState<{id:number;msg:string;type:string}[]>([])
  const toastId = useRef(0)

  function toast(msg: string, type='ok') {
    const id = ++toastId.current
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }

  // ── LOAD ──────────────────────────────────────────────────────
  const loadLeads = useCallback(async (q='') => {
    const url = q ? `/api/leads?q=${encodeURIComponent(q)}` : '/api/leads'
    const data = await fetch(url).then(r => r.json())
    setLeads(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    loadLeads()
    fetch('/api/voices').then(r=>r.json()).then(v => { setVoices(v); if(v[0]) setSelVoice(v[0].id) })
    fetch('/api/scripts').then(r=>r.json()).then(s => { setScripts(s); const d=s.find((x:Script)=>x.is_default); if(d) setSelScript(d.id) })
    fetch('/api/notes').then(r=>r.json()).then(setNotes)
    fetch('/api/config').then(r=>r.json()).then(c => { setCfg(c); if(c.THEME_COLOR) applyTheme(c.THEME_COLOR) })
    fetch('/api/briefing').then(r=>r.json()).then(b => setBriefing(b.briefing || ''))
  }, [loadLeads])

  useEffect(() => { if(msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight }, [msgs])

  function applyTheme(color: string) {
    document.documentElement.style.setProperty('--accent', color)
    setTheme(color)
  }

  // ── FILTERED LEADS ────────────────────────────────────────────
  const filteredLeads = leads
    .filter(l => {
      if (filterStage && l.stage !== filterStage) return false
      if (filterTemp  && l.temperature !== filterTemp) return false
      if (filterLang  && l.language !== filterLang) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'created_at') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'name') return (a.first_name||'').localeCompare(b.first_name||'')
      if (sortBy === 'temperature') return (a.temperature||'').localeCompare(b.temperature||'')
      if (sortBy === 'stage') return (a.stage||'').localeCompare(b.stage||'')
      return 0
    })

  // ── CALL ──────────────────────────────────────────────────────
  async function executeCall(leadId: string) {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    if (!lead.phone) { toast('Lead has no phone number', 'warn'); return }
    setCalling(leadId)
    try {
      const res = await fetch('/api/vapi/call', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ leadId, forceLanguage: lead.language || 'en' })
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error || 'Call failed', 'err'); return }
      toast(`📞 Calling ${lead.first_name} in ${(lead.language||'en').toUpperCase()}…`, 'ok')
      setTimeout(loadLeads, 3000)
    } catch(e: any) { toast(e.message, 'err') }
    finally { setCalling(null) }
  }

  // ── DELETE LEAD ───────────────────────────────────────────────
  async function deleteLead(id: string) {
    await fetch(`/api/leads/${id}`, { method:'DELETE' })
    setLeads(l => l.filter(x => x.id !== id))
    setSelLead(null)
    setConfirmDelete(null)
    toast('Lead deleted', 'ok')
  }

  // ── SEQUENCE TOGGLE ───────────────────────────────────────────
  async function toggleSequence(lead: Lead) {
    const isActive = lead.stage === 'contacted'
    if (isActive) {
      await patchLead(lead.id, { stage: 'new_lead' })
      toast(`⏹ Sequence paused for ${lead.first_name}`, 'ok')
    } else {
      await patchLead(lead.id, { stage: 'contacted' })
      toast(`▶ Sequence activated for ${lead.first_name}`, 'ok')
    }
  }

  // ── BULK ACTIONS ──────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleSelectAll() {
    if (selectedIds.size === filteredLeads.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredLeads.map(l => l.id)))
  }
  async function bulkExport() {
    const selected = leads.filter(l => selectedIds.has(l.id))
    const headers = ['first_name','last_name','phone','email','zip_code','language','stage','temperature','called_count','created_at']
    const rows = selected.map(l => headers.map(h => (l as any)[h]||'').join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type:'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='leads_export.csv'; a.click()
    toast('Exported ' + selected.length + ' leads', 'ok')
  }
  async function bulkDelete() {
    if (!confirm('Delete ' + selectedIds.size + ' leads? This cannot be undone.')) return
    for (const id of selectedIds) await fetch('/api/leads/' + id, { method:'DELETE' })
    setLeads(l => l.filter(x => !selectedIds.has(x.id)))
    setSelectedIds(new Set())
    toast('Leads deleted', 'ok')
  }
  async function applyBulkEdit() {
    if (!bulkStage && !bulkTemp && !bulkLang) { toast('Select at least one field to update','warn'); return }
    setBulkApplying(true)
    const updates: Record<string,any> = {}
    if (bulkStage) updates.stage = bulkStage
    if (bulkTemp)  updates.temperature = bulkTemp
    if (bulkLang)  updates.language = bulkLang
    await Promise.all(Array.from(selectedIds).map(id =>
      fetch('/api/leads/' + id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(updates) })
    ))
    await loadLeads()
    setSelectedIds(new Set()); setShowBulkEdit(false)
    setBulkStage(''); setBulkTemp(''); setBulkLang(''); setBulkApplying(false)
    toast('Updated leads', 'ok')
  }

  // ── OPEN LEAD MODAL ───────────────────────────────────────────
  async function openLead(lead: Lead) {
    setSelLead(lead)
    const calls = await fetch('/api/call?leadId=' + lead.id).then(r=>r.json())
    setLeadCalls(Array.isArray(calls) ? calls : [])
  }

  async function patchLead(id: string, updates: Record<string,any>) {
    await fetch(`/api/leads/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(updates) })
    await loadLeads()
    if (selLead?.id === id) setSelLead(l => l ? { ...l, ...updates } : l)
    toast('Saved', 'ok')
  }

  async function analyzeLead(id: string) {
    toast('🤖 Analyzing…', 'ok')
    try {
      // Get the lead's call history and qualification data to analyze
      const lead = leads.find(l => l.id === id)
      if (!lead) { toast('Lead not found', 'err'); return }

      const callsRes = await fetch(`/api/call?leadId=${id}`)
      const leadCalls = await callsRes.json()

      // Build context from calls
      const callSummaries = Array.isArray(leadCalls)
        ? leadCalls.filter((c:Call) => c.ai_summary).map((c:Call) => c.ai_summary).join('\n')
        : ''
      const transcript = Array.isArray(leadCalls)
        ? leadCalls.filter((c:Call) => c.transcript).map((c:Call) => c.transcript).join('\n')
        : ''

      const context = `
Lead: ${lead.first_name} ${lead.last_name}
Phone: ${lead.phone}
Language: ${lead.language}
Stage: ${lead.stage}
Temperature: ${lead.temperature}
Credit Score: ${lead.credit_score || 'unknown'}
Income: ${lead.income || 'unknown'}
Down Payment: ${lead.down_payment || 'unknown'}
Looking to Buy: ${lead.looking_to_buy || 'unknown'}
Call Count: ${lead.called_count || 0}
Call Summaries: ${callSummaries || 'No calls yet'}
Recent Transcript: ${transcript?.slice(0,1000) || 'No transcript'}
      `.trim()

      const res = await fetch('/api/chat', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          message: `Analyze this mortgage lead and provide: 1) A 2-3 sentence qualification summary, 2) Interest level (Hot/Warm/Cold/Not Interested), 3) Next best action. Be specific and actionable.\n\n${context}`,
          agent: 'sales_manager',
          history: []
        })
      })
      const data = await res.json()
      if (!res.ok || !data.reply) { toast('Analysis failed', 'err'); return }

      // Parse the AI response into structured fields
      const reply = data.reply
      const updates: Record<string,any> = {
        ai_analysis: reply,
        next_action: reply.match(/next best action[:\s]+([^\n.]+)/i)?.[1]?.trim() || '',
        interest_level: reply.toLowerCase().includes('hot') ? 'hot' :
                        reply.toLowerCase().includes('warm') ? 'warm' :
                        reply.toLowerCase().includes('not interested') ? 'not_interested' : 'cold',
      }

      await fetch(`/api/leads/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(updates) })
      await loadLeads()
      setSelLead(l => l ? { ...l, ...updates } : l)
      toast('✅ Analysis complete', 'ok')
    } catch(e: any) {
      toast('Analysis failed: ' + e.message, 'err')
    }
  }

  // ── IMPORT ────────────────────────────────────────────────────
  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const lines = (ev.target?.result as string).split('\n').filter(Boolean)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g,''))
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/"/g,''))
        const obj: Record<string,string> = {}
        headers.forEach((h,i) => obj[h] = vals[i]||'')
        return obj
      }).filter(r => r.first_name || r['first name'] || r.phone)
      setCsvRows(rows)
      toast(`${rows.length} leads parsed`, 'ok')
    }
    reader.readAsText(file)
  }

  async function doImport() {
    setImporting(true)
    try {
      let leadsToImport: any[]
      if (importTab === 'single') {
        if (!impF.first_name) { toast('First name required','warn'); return }
        leadsToImport = [impF]
      } else {
        if (!csvRows.length) { toast('Upload a CSV first','warn'); return }
        leadsToImport = csvRows.map(r => ({
          first_name: r.first_name||r['first name']||r.name?.split(' ')[0]||'',
          last_name:  r.last_name||r['last name']||r.name?.split(' ').slice(1).join(' ')||'',
          phone: r.phone||r['phone number']||'', email: r.email||'',
          zip_code: r.zip_code||r.zip||'', loan_amount: r.loan_amount||r['loan amount']||'',
        }))
      }
      const res = await fetch('/api/leads', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ leads: leadsToImport, source: importSrc }) })
      const data = await res.json()
      toast(`✅ ${data.imported} lead(s) imported`, 'ok')
      setShowImport(false)
      setImpF({ first_name:'', last_name:'', phone:'', email:'', zip_code:'', loan_amount:'', language:'en', notes:'' })
      setCsvRows([])
      await loadLeads()
    } catch(e:any) { toast(e.message,'err') }
    finally { setImporting(false) }
  }

  // ── CHAT ──────────────────────────────────────────────────────
  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return
    const text = chatInput.trim(); setChatInput('')
    const userMsg: Msg = { role:'user', content:text }
    setMsgs(m => [...m, userMsg])
    const history = [...chatHistory, { role:'user', content:text }]
    setChatHistory(history)
    setChatLoading(true)
    try {
      const res = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ message:text, agent, history: chatHistory.slice(-10) }) })
      const data = await res.json()
      const reply = data.reply || 'Something went wrong.'
      setMsgs(m => [...m, { role:'assistant', content:reply, agent: agent==='caller'?'AI Caller':'Sales Manager' }])
      setChatHistory(h => [...h, { role:'assistant', content:reply }])
    } catch { setMsgs(m => [...m, { role:'assistant', content:'Connection error.', agent:'System' }]) }
    finally { setChatLoading(false) }
  }

  async function quickAction(type: 'review'|'training') {
    const prompts = {
      review: 'Give me my daily review: pipeline breakdown, hot leads by name, what needs attention, performance score out of 10.',
      training: 'Give me one high-impact training session. Pick the most useful technique for my pipeline and walk me through it with a real script.'
    }
    setChatInput(prompts[type])
    setTimeout(sendChat, 50)
  }

  // ── SETTINGS ─────────────────────────────────────────────────
  async function saveSettings() {
    const updates: Record<string,string> = {}
    const fields = {
      'cfg-anthropic':'ANTHROPIC_API_KEY','cfg-twilio-sid':'TWILIO_ACCOUNT_SID',
      'cfg-twilio-token':'TWILIO_AUTH_TOKEN','cfg-twilio-phone':'TWILIO_PHONE_NUMBER',
      'cfg-el-key':'ELEVENLABS_API_KEY','cfg-el-voice':'ELEVENLABS_VOICE_ID',
      'cfg-meta-token':'META_ACCESS_TOKEN','cfg-meta-verify':'META_VERIFY_TOKEN',
    }
    for (const [id, key] of Object.entries(fields)) {
      const val = cfgInputs[id] || ''
      if (val) updates[key] = val
    }
    await fetch('/api/config', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(updates) })
    toast('✅ Settings saved', 'ok')
    const fresh = await fetch('/api/config').then(r=>r.json())
    setCfg(fresh)
    const v = await fetch('/api/voices').then(r=>r.json())
    setVoices(v); if(v[0] && !selVoice) setSelVoice(v[0].id)
  }

  // ── KANBAN DRAG ───────────────────────────────────────────────
  const [dragId, setDragId] = useState<string|null>(null)
  async function dropLead(stage: string) {
    if (!dragId) return
    await patchLead(dragId, { stage })
    setDragId(null)
  }

  // ── RENDER HELPERS ────────────────────────────────────────────
  const hot    = leads.filter(l => l.temperature==='hot').length
  const today  = leads.filter(l => new Date(l.created_at).toDateString()===new Date().toDateString()).length
  const called = leads.filter(l => l.called_count>0).length
  const rating = (id: number) => id>=7?'#22c55e':id>=4?'#f59e0b':id>0?'#ef4444':'#4b6080'

  const NAV = [
    { id:'dashboard', icon:'⚡', label:'Dashboard' },
    { id:'conversion', icon:'🎯', label:'Conversion' },
    { id:'deals', icon:'🏆', label:'Deals' },
    { id:'meeting', icon:'💬', label:'Meeting Room' },
    { id:'settings', icon:'⚙️', label:'Settings' },
  ]

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <div style={S.app}>
      {/* SIDEBAR */}
      <div style={S.sidebar}>
        <div style={S.logo}>Jordan<span style={{ color:theme }}>AI</span></div>
        <div style={{ flex:1, padding:'8px 0' }}>
          {NAV.map(n => (
            <div key={n.id} style={{ ...S.navItem, ...(view===n.id ? S.navActive : {}) }} onClick={() => setView(n.id)}>
              <span style={{ fontSize:15, width:18, textAlign:'center' }}>{n.icon}</span>{n.label}
              {n.id==='conversion' && hot>0 && <span style={{ marginLeft:'auto', background:'#ef4444', color:'#fff', fontSize:10, padding:'1px 6px', borderRadius:10, fontWeight:700 }}>{hot}</span>}
            </div>
          ))}
        </div>
        <div style={{ borderTop:'1px solid rgba(255,255,255,.08)', padding:10 }}>
          {['Sales Manager','AI Caller'].map(a => (
            <div key={a} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 8px', borderRadius:8, background:'#1a2540', marginBottom:6 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', flexShrink:0 }} />
              <div><div style={{ fontSize:12, fontWeight:700 }}>{a}</div><div style={{ fontSize:11, color:'#4b6080' }}>Ready</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <div style={S.main}>
        {/* TOPBAR */}
        <div style={S.topbar}>
          <div style={{ fontSize:16, fontWeight:700, flex:1 }}>{{ dashboard:'Dashboard', conversion:'Conversion', deals:'Deals', meeting:'Meeting Room', settings:'Settings' }[view]}</div>
          <button style={{ ...S.btnPrimary, ...S.btnSm }} onClick={() => { setView('conversion'); setShowImport(true) }}>+ Import Leads</button>
          <button style={{ ...S.btnOutline, ...S.btnSm }} onClick={() => { window.location.href='/api/leads/export' }}>⬇ Export CSV</button>
        </div>

        <div style={S.content}>

        {/* ── DASHBOARD ── */}
        {view==='dashboard' && (
          <div>
            <div style={{ ...S.card, marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#1d4ed8,#1e40af)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff' }}>SM</div>
                <div><div style={{ fontSize:13, fontWeight:700 }}>Sales Manager · Morning Briefing</div></div>
                <button style={{ ...S.btnOutline, ...S.btnSm, marginLeft:'auto' }} onClick={() => fetch('/api/briefing').then(r=>r.json()).then(b=>setBriefing(b.briefing))}>Refresh</button>
              </div>
              <div style={{ fontSize:13, lineHeight:1.7, color:'#94a3b8' }}>{briefing || <span style={{ color:'#4b6080' }}>Loading briefing…</span>}</div>
            </div>
            <div style={{ ...S.grid3, marginBottom:16 }}>
              {[['Total Leads',leads.length,'#60a5fa'],['Hot Leads',hot,'#ef4444'],['Called Today',called,'#22c55e']].map(([l,v,c])=>(
                <div key={l as string} style={S.statBox}><div style={S.statLabel}>{l}</div><div style={{ ...S.statVal, color:c as string }}>{v}</div></div>
              ))}
            </div>
            <div style={S.grid2}>
              <div style={S.card}>
                <div style={S.cardTitle}>Recent Leads</div>
                {leads.slice(0,5).map(l => (
                  <div key={l.id} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,.06)', fontSize:12 }}>
                    <span style={{ cursor:'pointer', color:'#60a5fa' }} onClick={() => openLead(l)}>{l.first_name} {l.last_name}</span>
                    <span style={{ color:TEMP_COLOR[l.temperature]||'#94a3b8', fontWeight:700 }}>{l.temperature}</span>
                  </div>
                ))}
                {!leads.length && <div style={{ color:'#4b6080', fontSize:13 }}>No leads yet</div>}
              </div>
              <div style={S.card}>
                <div style={S.cardTitle}>Quick Actions</div>
                {[['📥 Import Leads',()=>{setView('conversion');setShowImport(true)}],['🎯 Go to Conversion',()=>setView('conversion')],['💬 Talk to AI Team',()=>setView('meeting')],['⬇ Export CSV',()=>{window.location.href='/api/leads/export'}]].map(([l,fn])=>(
                  <button key={l as string} onClick={fn as any} style={{ ...S.btnOutline, width:'100%', marginBottom:8, textAlign:'left' as const }}>{l as string}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CONVERSION ── */}
        {view==='conversion' && (
          <div>


            {/* FILTERS */}
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:14, flexWrap:'wrap', background:'#111827', border:'1px solid rgba(255,255,255,.08)', borderRadius:10, padding:'10px 14px' }}>
              <span style={{ fontSize:12, color:'#4b6080', fontWeight:700 }}>FILTER:</span>
              <select value={filterStage} onChange={e=>setFilterStage(e.target.value)} style={{ ...S.select, fontSize:12, padding:'5px 8px' }}>
                <option value="">All Stages</option>
                {STAGES.map(s=><option key={s} value={s}>{STAGE_PILLS[s]?.label||s}</option>)}
              </select>
              <select value={filterTemp} onChange={e=>setFilterTemp(e.target.value)} style={{ ...S.select, fontSize:12, padding:'5px 8px' }}>
                <option value="">All Temps</option>
                <option value="hot">🔥 Hot</option>
                <option value="warm">🟡 Warm</option>
                <option value="cold">❄️ Cold</option>
              </select>
              <select value={filterLang} onChange={e=>setFilterLang(e.target.value)} style={{ ...S.select, fontSize:12, padding:'5px 8px' }}>
                <option value="">All Languages</option>
                <option value="en">🇺🇸 English</option>
                <option value="es">🇪🇸 Spanish</option>
              </select>
              <span style={{ fontSize:12, color:'#4b6080', fontWeight:700, marginLeft:8 }}>SORT:</span>
              <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ ...S.select, fontSize:12, padding:'5px 8px' }}>
                <option value="created_at">Date Added</option>
                <option value="name">Name</option>
                <option value="temperature">Temperature</option>
                <option value="stage">Stage</option>
              </select>
              {(filterStage||filterTemp||filterLang) && (
                <button onClick={()=>{setFilterStage('');setFilterTemp('');setFilterLang('')}} style={{ ...S.btnOutline, ...S.btnSm, fontSize:11, color:'#ef4444', borderColor:'rgba(239,68,68,.3)' }}>Clear ×</button>
              )}
              <span style={{ marginLeft:'auto', fontSize:12, color:'#4b6080' }}>{filteredLeads.length} of {leads.length} leads</span>
            </div>

            {/* BULK ACTION BAR */}
            {selectedIds.size > 0 && (
              <div style={{ display:'flex', gap:8, alignItems:'center', background:'rgba(59,130,246,.1)', border:'1px solid rgba(59,130,246,.3)', borderRadius:10, padding:'10px 14px', marginBottom:14 }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#60a5fa' }}>{selectedIds.size} lead{selectedIds.size!==1?'s':''} selected</span>
                <button onClick={()=>setShowBulkEdit(true)} style={{ ...S.btnPrimary, ...S.btnSm }}>✏️ Edit Fields</button>
                <button onClick={bulkExport} style={{ ...S.btnOutline, ...S.btnSm }}>⬇ Export</button>
                <button onClick={bulkDelete} style={{ ...S.btnSm, background:'rgba(239,68,68,.15)', border:'1px solid rgba(239,68,68,.3)', borderRadius:7, color:'#ef4444', cursor:'pointer', fontFamily:'Arial,sans-serif' }}>🗑 Delete</button>
                <button onClick={()=>setSelectedIds(new Set())} style={{ ...S.btnOutline, ...S.btnSm, marginLeft:'auto' }}>Clear</button>
              </div>
            )}

            <div style={{ ...S.grid4, marginBottom:14 }}>
              {[['Total',leads.length,'#60a5fa'],['Hot',hot,'#ef4444'],['New Today',today,'#22c55e'],['Called',called,'#f59e0b']].map(([l,v,c])=>(
                <div key={l as string} style={S.statBox}><div style={S.statLabel}>{l}</div><div style={{ ...S.statVal, color:c as string, fontSize:20 }}>{v}</div></div>
              ))}
            </div>
            <div style={{ background:'#111827', border:'1px solid rgba(255,255,255,.08)', borderRadius:10, overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,.08)' }}>
                <div style={{ fontSize:14, fontWeight:700 }}>Leads</div>
                <input placeholder="Search name, phone…" style={{ ...S.input, width:200 }} onInput={(e:any)=>{ setSearch(e.target.value); loadLeads(e.target.value) }} />
              </div>
              <table style={S.tbl}>
                <thead><tr>
                  <th style={{ ...S.th, width:40, textAlign:'center' }}>
                    <input type="checkbox" checked={selectedIds.size===filteredLeads.length&&filteredLeads.length>0} onChange={toggleSelectAll}
                      style={{ cursor:'pointer', accentColor:'#3b82f6', width:14, height:14 }} />
                  </th>
                  {['Name','Language','Stage','Temperature','Date Added','Called','Actions'].map(h=><th key={h} style={S.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {!filteredLeads.length && <tr><td colSpan={7} style={{ ...S.td, textAlign:'center', color:'#4b6080', padding:24 }}>No leads match filters</td></tr>}
                  {filteredLeads.map(l => {
                    const sp = STAGE_PILLS[l.stage]||STAGE_PILLS.new_lead
                    const seqActive = l.stage === 'contacted'
                    return (
                      <tr key={l.id} style={{ background: selectedIds.has(l.id)?'rgba(59,130,246,.06)':'transparent' }}>
                        <td style={{ ...S.td, textAlign:'center', width:40 }} onClick={e=>e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(l.id)} onChange={()=>toggleSelect(l.id)}
                            style={{ cursor:'pointer', accentColor:'#3b82f6', width:14, height:14 }} />
                        </td>
                        <td style={{ ...S.td, cursor:'pointer' }} onClick={()=>openLead(l)}><strong>{l.first_name} {l.last_name}</strong><div style={{ fontSize:11, color:'#4b6080' }}>{l.phone||l.email||'—'}</div></td>
                        <td style={S.td}><span style={{ fontSize:13 }}>{l.language==='es'?'🇪🇸':'🇺🇸'}</span></td>
                        <td style={S.td}><span style={{ display:'inline-block', padding:'3px 9px', borderRadius:12, fontSize:11, fontWeight:700, background:sp.bg, color:sp.color }}>{sp.label}</span></td>
                        <td style={S.td}><span style={{ fontSize:12, fontWeight:700, color:TEMP_COLOR[l.temperature]||'#94a3b8' }}>{l.temperature||'cold'}</span></td>
                        <td style={{ ...S.td, fontSize:11, color:'#4b6080' }}>{new Date(l.created_at).toLocaleDateString()}</td>
                        <td style={{ ...S.td, fontSize:12, color:'#94a3b8' }}>{l.called_count||0}x</td>
                        <td style={S.td} onClick={e=>e.stopPropagation()}>
                          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                            <button disabled={calling===l.id} onClick={()=>executeCall(l.id)} style={{ ...S.btnPrimary, ...S.btnSm }}>{calling===l.id?'⏳':'📞'}</button>
                            <button title="SMS" onClick={()=>setShowSMS(l)} style={{ ...S.btnOutline, ...S.btnSm }}>💬</button>
                            <button title="Email" onClick={()=>setShowEmail(l)} style={{ ...S.btnOutline, ...S.btnSm }}>📧</button>
                            <button title="Voicemail" onClick={()=>setShowVoicemail(l)} style={{ ...S.btnOutline, ...S.btnSm }}>📱</button>
                            <button title={seqActive?'Pause Sequence':'Activate Sequence'} onClick={()=>toggleSequence(l)}
                              style={{ ...S.btnSm, background: seqActive?'rgba(34,197,94,.15)':'rgba(255,255,255,.06)', border:`1px solid ${seqActive?'rgba(34,197,94,.4)':'rgba(255,255,255,.14)'}`, borderRadius:7, color:seqActive?'#22c55e':'#94a3b8', cursor:'pointer', fontFamily:'Arial,sans-serif' }}>
                              {seqActive?'⏸':'▶'}
                            </button>
                            <button title="Delete Lead" onClick={()=>setConfirmDelete(l)} style={{ ...S.btnSm, background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:7, color:'#ef4444', cursor:'pointer', fontFamily:'Arial,sans-serif' }}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── DEALS KANBAN ── */}
        {view==='deals' && (
          <div>
            <div style={{ display:'flex', overflowX:'auto', gap:12, paddingBottom:12 }}>
              {STAGES.map(stage => {
                const sp = STAGE_PILLS[stage]||STAGE_PILLS.new_lead
                const stageLeads = leads.filter(l=>l.stage===stage)
                return (
                  <div key={stage} style={{ minWidth:190, background:'#111827', border:'1px solid rgba(255,255,255,.08)', borderRadius:10 }}
                    onDragOver={e=>e.preventDefault()} onDrop={()=>dropLead(stage)}>
                    <div style={{ padding:12, borderBottom:'1px solid rgba(255,255,255,.08)' }}>
                      <div style={{ fontSize:12, fontWeight:700 }}>{sp.label}</div>
                      <div style={{ fontSize:11, color:'#4b6080', marginTop:2 }}>{stageLeads.length} lead{stageLeads.length!==1?'s':''}</div>
                    </div>
                    <div style={{ padding:8, display:'flex', flexDirection:'column', gap:7, minHeight:60 }}>
                      {stageLeads.map(l=>(
                        <div key={l.id} draggable onDragStart={()=>setDragId(l.id)} onClick={()=>openLead(l)}
                          style={{ background:'#1a2540', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, padding:10, cursor:'pointer' }}>
                          <div style={{ fontSize:13, fontWeight:700 }}>{l.first_name} {l.last_name}</div>
                          {l.loan_amount && <div style={{ fontSize:12, color:'#f59e0b', fontWeight:700 }}>${parseFloat(l.loan_amount||'0').toLocaleString()}</div>}
                          <div style={{ fontSize:11, color:'#4b6080', marginTop:3 }}>{l.phone||l.email||'—'}</div>
                          <div style={{ marginTop:5, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{ fontSize:10, fontWeight:700, color:TEMP_COLOR[l.temperature]||'#94a3b8' }}>● {l.temperature||'cold'}</span>
                            <span style={{ fontSize:10 }}>{l.language==='es'?'🇪🇸':'🇺🇸'}</span>
                          </div>
                        </div>
                      ))}
                      {!stageLeads.length && <div style={{ fontSize:11, color:'#4b6080', textAlign:'center', padding:12 }}>Drop here</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── MEETING ROOM ── */}
        {view==='meeting' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:16, height:'calc(100vh - 94px)' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:12, overflow:'hidden' }}>
              <div style={S.card}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', gap:20, alignItems:'center' }}>
                    {[['sales_manager','SM','Sales Manager','linear-gradient(135deg,#1d4ed8,#1e40af)'],['caller','C','AI Caller','linear-gradient(135deg,#92400e,#78350f)']].map(([id,init,name,bg])=>(
                      <div key={id} onClick={()=>setAgent(id as any)} style={{ textAlign:'center', cursor:'pointer', opacity:agent===id?1:.45 }}>
                        <div style={{ width:46, height:46, borderRadius:'50%', background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'#fff', margin:'0 auto 5px', border:agent===id?`3px solid ${theme}`:'3px solid transparent' }}>{init}</div>
                        <div style={{ fontSize:12, fontWeight:700 }}>{name}</div>
                        <div style={{ fontSize:11, color:'#22c55e' }}>● Active</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button style={{ ...S.btnOutline, ...S.btnSm }} onClick={()=>quickAction('review')}>📋 Daily Review</button>
                    <button style={{ ...S.btnOutline, ...S.btnSm }} onClick={()=>quickAction('training')}>🎓 Training</button>
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', gap:4, background:'#1a2540', borderRadius:8, padding:3, flexShrink:0 }}>
                {(['chat','training'] as const).map(t=>(
                  <button key={t} onClick={()=>setMeetingTab(t)} style={{ flex:1, padding:7, borderRadius:6, border:'none', background:meetingTab===t?'#111827':'transparent', color:meetingTab===t?'#e8edf5':'#94a3b8', fontSize:13, cursor:'pointer', fontFamily:'Arial,sans-serif', fontWeight:meetingTab===t?700:400 }}>
                    {t==='chat'?'Team Chat':'📚 Training Notes'}
                  </button>
                ))}
              </div>
              {meetingTab==='chat' && (
                <div style={{ ...S.card, flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>
                  <div ref={msgsRef} style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:12, paddingBottom:4 }}>
                    {msgs.map((m,i)=>(
                      <div key={i} style={{ ...S.msgRow, flexDirection:m.role==='user'?'row-reverse':'row' }}>
                        <div style={{ ...S.msgAv, background:m.role==='user'?'linear-gradient(135deg,#1d4ed8,#92400e)':m.agent==='AI Caller'?'linear-gradient(135deg,#92400e,#78350f)':'linear-gradient(135deg,#1d4ed8,#1e40af)' }}>
                          {m.role==='user'?'AG':m.agent==='AI Caller'?'C':'SM'}
                        </div>
                        <div>
                          {m.role==='assistant' && <div style={{ fontSize:11, color:'#4b6080', marginBottom:3 }}>{m.agent}</div>}
                          <div style={m.role==='user'?S.bubUser:S.bubAgent}>{m.content}</div>
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div style={S.msgRow}>
                        <div style={{ ...S.msgAv, background:'linear-gradient(135deg,#1d4ed8,#1e40af)' }}>SM</div>
                        <div style={{ ...S.bubAgent, display:'flex', gap:4, alignItems:'center' }}>
                          {[0,150,300].map(d=><div key={d} style={{ width:6, height:6, borderRadius:'50%', background:'#4b6080', animation:`pulse .8s ${d}ms infinite` }} />)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ borderTop:'1px solid rgba(255,255,255,.08)', paddingTop:10, display:'flex', gap:8 }}>
                    <textarea value={chatInput} onChange={e=>setChatInput(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}}}
                      rows={1} placeholder={`Ask ${agent==='caller'?'AI Caller':'Sales Manager'}…`}
                      style={{ flex:1, background:'#1a2540', border:'1px solid rgba(255,255,255,.14)', borderRadius:8, padding:'9px 12px', color:'#e8edf5', fontSize:13, fontFamily:'Arial,sans-serif', outline:'none', resize:'none' }} />
                    <button onClick={sendChat} disabled={chatLoading} style={{ width:38, height:38, background:theme, border:'none', borderRadius:8, cursor:'pointer', fontSize:18, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>↑</button>
                  </div>
                </div>
              )}
              {meetingTab==='training' && (
                <div style={{ ...S.card, flex:1, overflowY:'auto' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <div style={S.cardTitle}>Training Notes</div>
                    <button style={{ ...S.btnPrimary, ...S.btnSm }} onClick={()=>setShowNote(true)}>+ Add Note</button>
                  </div>
                  <div style={{ fontSize:12, color:'#4b6080', marginBottom:14 }}>Notes are fed to your AI agents on every call and chat.</div>
                  {!notes.length && <div style={{ color:'#4b6080', fontSize:13 }}>No notes yet.</div>}
                  {notes.map(n=>(
                    <div key={n.id} style={{ background:'#1a2540', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, padding:12, marginBottom:10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                        <div><span style={{ fontSize:13, fontWeight:700 }}>{n.title}</span><span style={{ fontSize:10, marginLeft:8, padding:'2px 7px', borderRadius:10, background:'rgba(59,130,246,.1)', color:'#60a5fa', fontWeight:700 }}>{n.category}</span></div>
                        <button onClick={async()=>{ await fetch(`/api/notes?id=${n.id}`,{method:'DELETE'}); setNotes(notes.filter(x=>x.id!==n.id)); toast('Deleted','ok') }} style={S.btnDanger}>Delete</button>
                      </div>
                      <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{n.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ ...S.card, overflowY:'auto' }}>
              <div style={S.cardTitle}>Today's Summary</div>
              {[['Total Leads',leads.length,'#60a5fa'],['Hot Leads',hot,'#ef4444'],['New Today',today,'#22c55e'],['Called',called,'#f59e0b']].map(([l,v,c])=>(
                <div key={l as string} style={{ padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
                  <div style={{ fontSize:11, color:'#4b6080', fontWeight:700, textTransform:'uppercase', letterSpacing:.5, marginBottom:4 }}>{l}</div>
                  <div style={{ fontSize:18, fontWeight:700, color:c as string }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {view==='settings' && (
          <div style={S.grid2}>
            <div style={S.card}>
              <div style={S.cardTitle}>API Keys</div>
              {[['cfg-anthropic','Anthropic API Key','password','sk-ant-…'],['cfg-twilio-sid','Twilio Account SID','text','ACxxxxxxxx'],['cfg-twilio-token','Twilio Auth Token','password','Auth Token'],['cfg-twilio-phone','Twilio Phone Number','text','+15550000000'],['cfg-el-key','ElevenLabs API Key','password','xi-api-key…'],['cfg-el-voice','ElevenLabs Voice ID','text','e.g. pNInz6obpgDQGcFmaJgB']].map(([id,label,type,ph])=>(
                <div key={id} style={S.field}>
                  <label style={S.label}>{label}</label>
                  <input type={type} placeholder={(cfg as any)[id.replace('cfg-','').replace('-','_').toUpperCase()]||ph as string}
                    value={cfgInputs[id]||''} onChange={e=>setCfgInputs(c=>({...c,[id]:e.target.value}))} style={S.input} />
                </div>
              ))}
              <button style={S.btnPrimary} onClick={saveSettings}>Save All Keys</button>
            </div>
            <div style={S.card}>
              <div style={S.cardTitle}>Theme Color</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                {['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#ef4444','#06b6d4','#f97316'].map(c=>(
                  <div key={c} onClick={()=>{ applyTheme(c); fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({THEME_COLOR:c})}) }}
                    style={{ width:30, height:30, borderRadius:'50%', background:c, cursor:'pointer', border:theme===c?'3px solid #fff':'3px solid transparent' }} />
                ))}
              </div>
              <div style={{ ...S.cardTitle, marginTop:20 }}>Connection Status</div>
              {[['Anthropic AI',cfg.ANTHROPIC_API_KEY==='✓ Set'],['Twilio',cfg.TWILIO_ACCOUNT_SID==='✓ Set'],['ElevenLabs',cfg.ELEVENLABS_API_KEY==='✓ Set']].map(([n,ok])=>(
                <div key={n as string} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,.06)', fontSize:13 }}>
                  <span>{n as string}</span>
                  <span style={{ fontWeight:700, color:ok?'#22c55e':'#f59e0b' }}>{ok?'✅ Connected':'⚠️ Not set'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        </div>
      </div>

      {/* ── MODALS ── */}

      {/* IMPORT */}
      {showImport && (
        <div style={S.modalBg} onClick={e=>{if(e.target===e.currentTarget)setShowImport(false)}}>
          <div style={{ ...S.modal, width:520 }}>
            <div style={S.modalHead}><div style={S.modalTitle}>Import Leads</div><button style={S.closeBtn} onClick={()=>setShowImport(false)}>×</button></div>
            <div style={{ display:'flex', gap:4, background:'#1a2540', borderRadius:8, padding:3, marginBottom:16 }}>
              {(['single','csv'] as const).map(t=>(
                <button key={t} onClick={()=>setImportTab(t)} style={{ flex:1, padding:7, borderRadius:6, border:'none', background:importTab===t?'#111827':'transparent', color:importTab===t?'#e8edf5':'#94a3b8', fontSize:13, cursor:'pointer', fontFamily:'Arial,sans-serif', fontWeight:importTab===t?700:400 }}>
                  {t==='single'?'Single Lead':'CSV Upload'}
                </button>
              ))}
            </div>
            <div style={S.field}><label style={S.label}>Source</label>
              <select value={importSrc} onChange={e=>setImportSrc(e.target.value)} style={{ ...S.select, width:'100%' }}>
                {['Manual','Meta Ads','Google Ads','Referral','Cold List','Website','Event','Other'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            {importTab==='single' ? (
              <div>
                <div style={S.fieldRow}>
                  <div style={S.field}><label style={S.label}>First Name *</label><input value={impF.first_name} onChange={e=>setImpF(f=>({...f,first_name:e.target.value}))} style={S.input} placeholder="First" /></div>
                  <div style={S.field}><label style={S.label}>Last Name</label><input value={impF.last_name} onChange={e=>setImpF(f=>({...f,last_name:e.target.value}))} style={S.input} placeholder="Last" /></div>
                </div>
                <div style={S.fieldRow}>
                  <div style={S.field}><label style={S.label}>Phone</label><input value={impF.phone} onChange={e=>setImpF(f=>({...f,phone:e.target.value}))} style={S.input} placeholder="+1 (555) 000-0000" /></div>
                  <div style={S.field}><label style={S.label}>Email</label><input value={impF.email} onChange={e=>setImpF(f=>({...f,email:e.target.value}))} style={S.input} placeholder="email@example.com" /></div>
                </div>
                <div style={S.fieldRow}>
                  <div style={S.field}><label style={S.label}>Zip Code</label><input value={impF.zip_code} onChange={e=>setImpF(f=>({...f,zip_code:e.target.value}))} style={S.input} /></div>
                  <div style={S.field}><label style={S.label}>Loan Amount ($)</label><input value={impF.loan_amount} onChange={e=>setImpF(f=>({...f,loan_amount:e.target.value}))} style={S.input} /></div>
                </div>
                <div style={S.field}><label style={S.label}>Language</label>
                  <select value={impF.language} onChange={e=>setImpF(f=>({...f,language:e.target.value}))} style={{ ...S.select, width:'100%' }}>
                    <option value="en">🇺🇸 English</option><option value="es">🇪🇸 Spanish</option>
                  </select>
                </div>
                <div style={S.field}><label style={S.label}>Notes</label><textarea value={impF.notes} onChange={e=>setImpF(f=>({...f,notes:e.target.value}))} rows={2} style={{ ...S.input, resize:'vertical' }} /></div>
              </div>
            ) : (
              <div>
                <div style={{ border:'2px dashed rgba(255,255,255,.14)', borderRadius:8, padding:24, textAlign:'center', cursor:'pointer', marginBottom:12 }} onClick={()=>fileRef.current?.click()}>
                  <div style={{ fontSize:28, marginBottom:8 }}>📂</div>
                  <div style={{ fontSize:13, color:'#94a3b8' }}>Click to upload CSV</div>
                  <div style={{ fontSize:11, color:'#4b6080', marginTop:4 }}>Columns: first_name, last_name, phone, email, zip_code, loan_amount</div>
                  <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} style={{ display:'none' }} />
                </div>
                {csvRows.length>0 && <div style={{ background:'#1a2540', borderRadius:8, padding:10, fontSize:12, color:'#22c55e' }}>✅ {csvRows.length} leads ready</div>}
              </div>
            )}
            <button onClick={doImport} disabled={importing} style={{ ...S.btnPrimary, width:'100%', padding:11, marginTop:14 }}>
              {importing ? 'Importing…' : `Import ${importTab==='csv'&&csvRows.length?csvRows.length+' ':''}Lead${importTab==='csv'&&csvRows.length!==1?'s':''}`}
            </button>
          </div>
        </div>
      )}

      {/* SMS MODAL */}
      {showSMS && (
        <div style={S.modalBg} onClick={e=>{if(e.target===e.currentTarget)setShowSMS(null)}}>
          <div style={{ ...S.modal, width:460 }}>
            <div style={S.modalHead}>
              <div style={S.modalTitle}>Send SMS to {showSMS.first_name}</div>
              <button style={S.closeBtn} onClick={()=>setShowSMS(null)}>×</button>
            </div>
            <div style={{ fontSize:12, color:'#4b6080', marginBottom:12 }}>📱 {showSMS.phone}</div>
            <div style={S.field}>
              <label style={S.label}>Message</label>
              <textarea value={smsText} onChange={e=>setSmsText(e.target.value)} rows={4}
                placeholder={`Hi ${showSMS.first_name}, this is Vero from Dream Key Lending Group. Following up on your interest in buying a home. Reply STOP to opt out.`}
                style={{ ...S.input, resize:'vertical', lineHeight:1.6 }} />
              <div style={{ fontSize:11, color:'#4b6080', marginTop:4, textAlign:'right' }}>{smsText.length}/160</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ ...S.btnPrimary, flex:1, padding:10 }} disabled={sendingAction||!smsText.trim()} onClick={async()=>{
                setSendingAction(true)
                try {
                  await fetch('/api/sms', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ to: showSMS.phone, message: smsText, leadId: showSMS.id }) })
                  toast(`✅ SMS sent to ${showSMS.first_name}`, 'ok')
                  setSmsText(''); setShowSMS(null)
                } catch(e:any) { toast('SMS failed: ' + e.message, 'err') }
                finally { setSendingAction(false) }
              }}>{sendingAction ? 'Sending…' : '📤 Send SMS'}</button>
              <button style={{ ...S.btnOutline, padding:10 }} onClick={()=>setShowSMS(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL MODAL */}
      {showEmail && (
        <div style={S.modalBg} onClick={e=>{if(e.target===e.currentTarget)setShowEmail(null)}}>
          <div style={{ ...S.modal, width:520 }}>
            <div style={S.modalHead}>
              <div style={S.modalTitle}>Send Email to {showEmail.first_name}</div>
              <button style={S.closeBtn} onClick={()=>setShowEmail(null)}>×</button>
            </div>
            <div style={{ fontSize:12, color:'#4b6080', marginBottom:12 }}>📧 {showEmail.email||'No email on file'}</div>
            <div style={S.field}>
              <label style={S.label}>Subject</label>
              <input value={emailSubject} onChange={e=>setEmailSubject(e.target.value)}
                placeholder="Your home buying journey starts here"
                style={S.input} />
            </div>
            <div style={S.field}>
              <label style={S.label}>Message</label>
              <textarea value={emailBody} onChange={e=>setEmailBody(e.target.value)} rows={6}
                placeholder={`Hi ${showEmail.first_name},\n\nThis is Vero from Dream Key Lending Group. We saw you expressed interest in buying a home and wanted to follow up.\n\nBest,\nVero`}
                style={{ ...S.input, resize:'vertical', lineHeight:1.6 }} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ ...S.btnPrimary, flex:1, padding:10 }} disabled={sendingAction||!emailBody.trim()||!showEmail.email} onClick={async()=>{
                setSendingAction(true)
                try {
                  await fetch('/api/email', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ to: showEmail.email, subject: emailSubject, body: emailBody, leadId: showEmail.id }) })
                  toast(`✅ Email sent to ${showEmail.first_name}`, 'ok')
                  setEmailSubject(''); setEmailBody(''); setShowEmail(null)
                } catch(e:any) { toast('Email failed: ' + e.message, 'err') }
                finally { setSendingAction(false) }
              }}>{sendingAction ? 'Sending…' : '📤 Send Email'}</button>
              <button style={{ ...S.btnOutline, padding:10 }} onClick={()=>setShowEmail(null)}>Cancel</button>
            </div>
            {!showEmail.email && <div style={{ fontSize:12, color:'#f59e0b', marginTop:8 }}>⚠️ No email address on file for this lead.</div>}
          </div>
        </div>
      )}

      {/* VOICEMAIL MODAL */}
      {showVoicemail && (
        <div style={S.modalBg} onClick={e=>{if(e.target===e.currentTarget)setShowVoicemail(null)}}>
          <div style={{ ...S.modal, width:460 }}>
            <div style={S.modalHead}>
              <div style={S.modalTitle}>Drop Voicemail to {showVoicemail.first_name}</div>
              <button style={S.closeBtn} onClick={()=>setShowVoicemail(null)}>×</button>
            </div>
            <div style={{ fontSize:12, color:'#4b6080', marginBottom:12 }}>📞 {showVoicemail.phone}</div>
            <div style={{ background:'rgba(59,130,246,.08)', border:'1px solid rgba(59,130,246,.2)', borderRadius:8, padding:12, fontSize:12, color:'#60a5fa', marginBottom:14 }}>
              ℹ️ AI will call and leave a pre-recorded voicemail if no answer.
            </div>
            <div style={S.field}>
              <label style={S.label}>Voicemail Script</label>
              <textarea value={vmScript} onChange={e=>setVmScript(e.target.value)} rows={5}
                placeholder={`Hi ${showVoicemail.first_name}, this is Vero from Dream Key Lending Group. I'm calling about your interest in buying a home. We have some great programs that could work for you. Please call us back or reply to this message. Have a great day!`}
                style={{ ...S.input, resize:'vertical', lineHeight:1.6 }} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ ...S.btnPrimary, flex:1, padding:10 }} disabled={sendingAction} onClick={async()=>{
                setSendingAction(true)
                try {
                  await fetch('/api/vapi/call', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ leadId: showVoicemail.id, forceLanguage: showVoicemail.language||'en', voicemailMode: true, script: vmScript }) })
                  toast(`✅ Voicemail drop initiated for ${showVoicemail.first_name}`, 'ok')
                  setVmScript(''); setShowVoicemail(null)
                } catch(e:any) { toast('Voicemail failed: ' + e.message, 'err') }
                finally { setSendingAction(false) }
              }}>{sendingAction ? 'Dropping…' : '📱 Drop Voicemail'}</button>
              <button style={{ ...S.btnOutline, padding:10 }} onClick={()=>setShowVoicemail(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {confirmDelete && (
        <div style={S.modalBg} onClick={e=>{if(e.target===e.currentTarget)setConfirmDelete(null)}}>
          <div style={{ ...S.modal, width:380 }}>
            <div style={S.modalHead}>
              <div style={S.modalTitle}>Delete Lead</div>
              <button style={S.closeBtn} onClick={()=>setConfirmDelete(null)}>×</button>
            </div>
            <div style={{ fontSize:13, color:'#94a3b8', marginBottom:20, lineHeight:1.6 }}>
              Are you sure you want to delete <strong style={{ color:'#e8edf5' }}>{confirmDelete.first_name} {confirmDelete.last_name}</strong>? This will remove all their data including call history. This cannot be undone.
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ ...S.btnDanger, flex:1, padding:10, fontSize:13 }} onClick={()=>deleteLead(confirmDelete.id)}>Yes, Delete</button>
              <button style={{ ...S.btnOutline, flex:1, padding:10 }} onClick={()=>setConfirmDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* SCRIPT EDITOR */}
      {showScript && (
        <div style={S.modalBg} onClick={e=>{if(e.target===e.currentTarget)setShowScript(false)}}>
          <div style={{ ...S.modal, width:560 }}>
            <div style={S.modalHead}><div style={S.modalTitle}>Call Script</div><button style={S.closeBtn} onClick={()=>setShowScript(false)}>×</button></div>
            <div style={S.field}><label style={S.label}>Name</label><input value={sForm.name} onChange={e=>setSForm(f=>({...f,name:e.target.value}))} style={S.input} placeholder="e.g. FHA First-Time Buyer" /></div>
            <div style={S.field}><label style={S.label}>Lead Type</label>
              <select value={sForm.lead_type} onChange={e=>setSForm(f=>({...f,lead_type:e.target.value}))} style={{ ...S.select, width:'100%' }}>
                {['general','fha_buyer','va_buyer','investor','seller','refinance'].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>Script</label>
              <textarea value={sForm.script} onChange={e=>setSForm(f=>({...f,script:e.target.value}))} rows={10} style={{ ...S.input, lineHeight:1.6, resize:'vertical' }} placeholder="Use [LEAD_NAME] and [AGENT_NAME] as placeholders." />
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
              <input type="checkbox" id="def" checked={sForm.is_default} onChange={e=>setSForm(f=>({...f,is_default:e.target.checked}))} />
              <label htmlFor="def" style={{ fontSize:13, cursor:'pointer' }}>Set as default script</label>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ ...S.btnPrimary, flex:1, padding:10 }} onClick={async()=>{
                if(!sForm.name||!sForm.script){toast('Name and script required','warn');return}
                await fetch('/api/scripts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sForm)})
                const s=await fetch('/api/scripts').then(r=>r.json()); setScripts(s)
                toast('✅ Script saved','ok'); setShowScript(false); setSForm({name:'',script:'',lead_type:'general',is_default:false})
              }}>Save Script</button>
              <button style={{ ...S.btnOutline, flex:1, padding:10 }} onClick={()=>setShowScript(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* TRAINING NOTE */}
      {showNote && (
        <div style={S.modalBg} onClick={e=>{if(e.target===e.currentTarget)setShowNote(false)}}>
          <div style={{ ...S.modal, width:500 }}>
            <div style={S.modalHead}><div style={S.modalTitle}>Add Training Note</div><button style={S.closeBtn} onClick={()=>setShowNote(false)}>×</button></div>
            <div style={S.field}><label style={S.label}>Title</label><input value={nForm.title} onChange={e=>setNForm(f=>({...f,title:e.target.value}))} style={S.input} /></div>
            <div style={S.field}><label style={S.label}>Category</label>
              <select value={nForm.category} onChange={e=>setNForm(f=>({...f,category:e.target.value}))} style={{ ...S.select, width:'100%' }}>
                {['general','objections','scripts','market','compliance'].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={S.field}><label style={S.label}>Content</label><textarea value={nForm.content} onChange={e=>setNForm(f=>({...f,content:e.target.value}))} rows={8} style={{ ...S.input, resize:'vertical', lineHeight:1.6 }} /></div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ ...S.btnPrimary, flex:1, padding:10 }} onClick={async()=>{
                if(!nForm.title||!nForm.content){toast('Title and content required','warn');return}
                await fetch('/api/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(nForm)})
                const n=await fetch('/api/notes').then(r=>r.json()); setNotes(n)
                toast('✅ Note saved','ok'); setShowNote(false); setNForm({title:'',content:'',category:'general'})
              }}>Save Note</button>
              <button style={{ ...S.btnOutline, flex:1, padding:10 }} onClick={()=>setShowNote(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* LEAD DETAIL */}
      {selLead && (
        <div style={S.modalBg} onClick={e=>{if(e.target===e.currentTarget)setSelLead(null)}}>
          <div style={{ ...S.modal, width:640 }}>
            <div style={S.modalHead}>
              <div>
                <div style={S.modalTitle}>{selLead.first_name} {selLead.last_name}</div>
                {(() => { const sp=STAGE_PILLS[selLead.stage]||STAGE_PILLS.new_lead; return <span style={{ display:'inline-block', marginTop:4, padding:'3px 9px', borderRadius:12, fontSize:11, fontWeight:700, background:sp.bg, color:sp.color }}>{sp.label}</span> })()}
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <button onClick={()=>{setSelLead(null);setConfirmDelete(selLead)}} style={{ ...S.btnSm, background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:7, color:'#ef4444', cursor:'pointer', fontFamily:'Arial,sans-serif' }}>🗑 Delete</button>
                <button style={S.closeBtn} onClick={()=>setSelLead(null)}>×</button>
              </div>
            </div>
            {/* Call bar */}
            <div style={{ background:'#1a2540', borderRadius:8, padding:12, marginBottom:14, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <button disabled={calling===selLead.id} onClick={()=>executeCall(selLead.id)} style={{ ...S.btnPrimary, padding:'9px 20px' }}>
                {calling===selLead.id?'⏳ Dialing…':'📞 Execute AI Call'}
              </button>
              <button onClick={()=>{setSelLead(null);setShowSMS(selLead)}} style={{ ...S.btnOutline, ...S.btnSm }}>💬 SMS</button>
              <button onClick={()=>{setSelLead(null);setShowEmail(selLead)}} style={{ ...S.btnOutline, ...S.btnSm }}>📧 Email</button>
              <button onClick={()=>{setSelLead(null);setShowVoicemail(selLead)}} style={{ ...S.btnOutline, ...S.btnSm }}>📱 Voicemail</button>
              <div style={{ fontSize:12, color:'#94a3b8' }}>
                {selLead.language==='es'?'🇪🇸 Spanish':'🇺🇸 English'} · Called: {selLead.called_count||0}x
              </div>
              {(selLead.lead_rating||0)>0 && (
                <div style={{ marginLeft:'auto', textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:700, color:rating(selLead.lead_rating||0) }}>{selLead.lead_rating}<span style={{ fontSize:13, color:'#4b6080' }}>/10</span></div>
                  <div style={{ fontSize:10, color:'#4b6080', textTransform:'uppercase', letterSpacing:.5 }}>Lead Quality</div>
                </div>
              )}
            </div>
            <div style={{ ...S.grid2, gap:14, marginBottom:14 }}>
              <div>
                <div style={{ fontSize:11, color:'#4b6080', fontWeight:700, textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>Contact Info</div>
                {/* Read-only fields */}
                {[
                  ['Phone', selLead.phone],
                  ['Email', selLead.email],
                  ['Zip', selLead.zip_code],
                  ['Source', selLead.source],
                  ['Language', selLead.language==='es'?'🇪🇸 Spanish':'🇺🇸 English'],
                  ['Status', selLead.temperature || 'cold'],
                  ['Date Added', selLead.created_at ? new Date(selLead.created_at).toLocaleDateString() : '—'],
                  ['Last Called', selLead.last_called ? new Date(selLead.last_called).toLocaleDateString() : 'Never'],
                ].filter(([,v])=>v).map(([k,v])=>(
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,.06)', fontSize:12 }}>
                    <span style={{ color:'#4b6080' }}>{k}</span>
                    <span style={{ fontWeight:700, color: k==='Status' ? (TEMP_COLOR[v as string]||'#94a3b8') : '#e8edf5' }}>{v}</span>
                  </div>
                ))}
                <div style={{ fontSize:11, color:'#4b6080', fontWeight:700, textTransform:'uppercase', letterSpacing:.5, margin:'12px 0 8px' }}>
                  Qualifying <span style={{ color:'#60a5fa', fontWeight:400, fontSize:10 }}>(AI fills from calls)</span>
                </div>
                {[['loan_amount','Loan Amount ($)',selLead.loan_amount,'350000'],['credit_score','Credit Score',selLead.credit_score,'680-720'],['income','Monthly Income',selLead.income,'$6,500/mo'],['down_payment','Down Payment',selLead.down_payment,'$20,000'],['looking_to_buy','Where to Buy',selLead.looking_to_buy,'Miami, FL'],['timeline','Timeline',selLead.timeline,'3-6 months']].map(([field,label,val,ph])=>(
                  <div key={field} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,.06)', fontSize:12, gap:8 }}>
                    <span style={{ color:'#4b6080', flexShrink:0 }}>{label}</span>
                    <input defaultValue={val||''} placeholder={ph} onBlur={e=>patchLead(selLead.id,{[field]:e.target.value})}
                      style={{ background:'transparent', border:'none', borderBottom:'1px solid rgba(255,255,255,.14)', borderRadius:0, padding:'2px 4px', fontSize:12, color:'#e8edf5', textAlign:'right', width:130, outline:'none', fontFamily:'Arial,sans-serif' }} />
                  </div>
                ))}
                {/* Language toggle */}
                <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', fontSize:12, alignItems:'center' }}>
                  <span style={{ color:'#4b6080' }}>Call Language</span>
                  <select defaultValue={selLead.language||'en'} onChange={e=>patchLead(selLead.id,{language:e.target.value})} style={{ ...S.select, fontSize:11, padding:'3px 7px' }}>
                    <option value="en">🇺🇸 English</option><option value="es">🇪🇸 Spanish</option>
                  </select>
                </div>
                <button style={{ ...S.btnPrimary, width:'100%', marginTop:8, padding:8, fontSize:12 }} onClick={()=>analyzeLead(selLead.id)}>🤖 Run AI Analysis</button>
              </div>
              {/* AI Analysis */}
              <div>
                <div style={{ fontSize:11, color:'#4b6080', fontWeight:700, textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>AI Analysis</div>
                <div style={{ background:'#1a2540', borderRadius:8, padding:10, fontSize:12, lineHeight:1.6, color:'#94a3b8', marginBottom:10, minHeight:60 }}>
                  {selLead.ai_analysis||'No analysis yet — execute a call to qualify.'}
                </div>
                {selLead.next_action && (
                  <div style={{ background:'rgba(59,130,246,.08)', border:'1px solid rgba(59,130,246,.2)', borderRadius:8, padding:10, fontSize:12, marginBottom:10 }}>
                    <div style={{ fontSize:10, color:'#60a5fa', fontWeight:700, marginBottom:4, textTransform:'uppercase' }}>⚡ Next Best Action</div>
                    {selLead.next_action}
                  </div>
                )}
                {selLead.interest_level && (
                  <div style={{ background:'#1a2540', borderRadius:8, padding:10, fontSize:12, color:'#94a3b8' }}>
                    <div style={{ fontSize:10, color:'#4b6080', fontWeight:700, marginBottom:4, textTransform:'uppercase' }}>Interest Level</div>
                    <span style={{ fontWeight:700, color: TEMP_COLOR[selLead.interest_level]||'#94a3b8' }}>"{selLead.interest_level}"</span>
                  </div>
                )}
              </div>
            </div>
            {/* Call History */}
            {leadCalls.length>0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:'#4b6080', fontWeight:700, textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Call History</div>
                {leadCalls.map(c=>(
                  <div key={c.id} style={{ background:'#1a2540', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, padding:12, marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                        <span style={{ fontSize:12, fontWeight:700 }}>📞 {new Date(c.created_at).toLocaleString()}</span>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, fontWeight:700,
                          background: c.status==='completed'?'rgba(34,197,94,.15)':c.status==='no_answer'?'rgba(245,158,11,.15)':'rgba(59,130,246,.1)',
                          color: c.status==='completed'?'#22c55e':c.status==='no_answer'?'#f59e0b':'#60a5fa' }}>{c.status}</span>
                        {c.disposition && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, fontWeight:700, background:'rgba(59,130,246,.1)', color:'#60a5fa' }}>{c.disposition}</span>}
                      </div>
                      <span style={{ fontSize:11, color:'#4b6080' }}>
                        {c.duration_seconds ? Math.floor(c.duration_seconds/60)+'m '+(c.duration_seconds%60)+'s' : c.duration ? Math.round(c.duration/60)+'m '+c.duration%60+'s' : ''}
                      </span>
                    </div>
                    {c.ai_summary && <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.5, marginBottom:8 }}>{c.ai_summary}</div>}
                    {c.recording_url && <audio controls src={c.recording_url} style={{ width:'100%', height:32 }} />}
                  </div>
                ))}
              </div>
            )}
            {/* Notes */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:'#4b6080', fontWeight:700, textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>Notes</div>
              <textarea defaultValue={selLead.notes||''} rows={3} onBlur={e=>patchLead(selLead.id,{notes:e.target.value})} style={{ ...S.input, resize:'vertical' }} placeholder="Add notes…" />
            </div>
            {/* Stage */}
            <div>
              <div style={{ fontSize:11, color:'#4b6080', fontWeight:700, textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>Move Stage</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {['contacted','appointment_set','doc_request','pre_approved','closed_won','closed_lost'].map(s => {
                  const sp = STAGE_PILLS[s]||STAGE_PILLS.new_lead
                  return <button key={s} onClick={()=>patchLead(selLead.id,{stage:s})} style={{ padding:'5px 10px', background:selLead.stage===s?theme:'#1a2540', border:`1px solid ${selLead.stage===s?theme:'rgba(255,255,255,.14)'}`, borderRadius:7, color:selLead.stage===s?'#fff':'#94a3b8', fontSize:11, cursor:'pointer', fontFamily:'Arial,sans-serif' }}>{sp.label}</button>
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BULK EDIT MODAL */}
      {showBulkEdit && (
        <div style={S.modalBg} onClick={e=>{if(e.target===e.currentTarget)setShowBulkEdit(false)}}>
          <div style={{ ...S.modal, width:420 }}>
            <div style={S.modalHead}>
              <div style={S.modalTitle}>Edit {selectedIds.size} Lead{selectedIds.size!==1?'s':''}</div>
              <button style={S.closeBtn} onClick={()=>setShowBulkEdit(false)}>x</button>
            </div>
            <div style={{ fontSize:12, color:'#4b6080', marginBottom:16 }}>Leave a field blank to keep existing values unchanged.</div>
            <div style={S.field}>
              <label style={S.label}>Stage</label>
              <select value={bulkStage} onChange={e=>setBulkStage(e.target.value)} style={{ ...S.select, width:'100%' }}>
                <option value="">— Keep existing —</option>
                {['new_lead','contacted','appointment_set','doc_request','pre_approved','closed_won','closed_lost'].map(s=>(
                  <option key={s} value={s}>{STAGE_PILLS[s]?.label||s}</option>
                ))}
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>Temperature</label>
              <select value={bulkTemp} onChange={e=>setBulkTemp(e.target.value)} style={{ ...S.select, width:'100%' }}>
                <option value="">— Keep existing —</option>
                <option value="hot">Hot</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
                <option value="not_interested">Not Interested</option>
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>Language</label>
              <select value={bulkLang} onChange={e=>setBulkLang(e.target.value)} style={{ ...S.select, width:'100%' }}>
                <option value="">— Keep existing —</option>
                <option value="en">English</option>
                <option value="es">Spanish</option>
              </select>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button style={{ ...S.btnPrimary, flex:1, padding:10 }} disabled={bulkApplying} onClick={applyBulkEdit}>
                {bulkApplying ? 'Applying…' : 'Apply to ' + selectedIds.size + ' lead' + (selectedIds.size!==1?'s':'')}
              </button>
              <button style={{ ...S.btnOutline, padding:10 }} onClick={()=>setShowBulkEdit(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* TOASTS */}
      <div style={{ position:'fixed', bottom:20, right:20, zIndex:9999, display:'flex', flexDirection:'column', gap:8 }}>
        {toasts.map(t=>(
          <div key={t.id} style={{ background:'#111827', border:'1px solid rgba(255,255,255,.14)', borderRadius:8, padding:'11px 16px', fontSize:13, display:'flex', gap:9, alignItems:'center', minWidth:240, boxShadow:'0 4px 20px rgba(0,0,0,.5)' }}>
            <span>{t.type==='ok'?'✅':t.type==='warn'?'⚠️':'❌'}</span><span>{t.msg}</span>
          </div>
        ))}
      </div>

      <style>{`
        *{box-sizing:border-box}
        body{margin:0;overflow:hidden}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:#1a2540;border-radius:2px}
        input::placeholder,textarea::placeholder{color:#4b6080}
        input:focus,select:focus,textarea:focus{border-color:var(--accent,#3b82f6)!important}
        @keyframes pulse{0%,80%,100%{transform:scale(1);opacity:.4}40%{transform:scale(1.3);opacity:1}}
      `}</style>
    </div>
  )
}
