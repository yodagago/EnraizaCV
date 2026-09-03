(() => {
  'use strict';
  const STORAGE_KEY = 'enraizacv.state.v1';
  const defaultState = { people: [], records: [], settings: { cuttingsPerTray: 130, duplicateSeconds: 5, dailyGoal: 5, syncUrl: '', autoSync: false, labelWidth: 52, labelHeight: 38, labelQrSize: 110, labelColumns: 3, labelGap: 4 } };
  let state = loadState();
  let cameraStream = null;
  let cameraLoop = null;
  const $ = id => document.getElementById(id);
  const els = {};
  const ids = ['networkDot','networkText','todayLabel','scanForm','scanCode','origin','trayCount','registerFeedback','todayTrays','todayCuttings','todayPeople','pendingCount','recentRecords','personForm','personName','personId','personCode','peopleImport','printAllQrButton','peopleTotal','peopleTable','peopleEmpty','summaryPeriod','metricTrays','metricCuttings','metricPeople','metricAverage','goalLabel','personBars','recordsTable','recordsEmpty','exportButton','settingsForm','cuttingsPerTray','duplicateSeconds','dailyGoal','syncForm','syncUrl','autoSync','syncButton','syncStatus','labelSettingsForm','labelWidth','labelHeight','labelQrSize','labelColumns','labelGap','clearRecordsButton','cameraButton','cameraDialog','cameraVideo','cameraStatus','closeCamera','qrDialog','qrPersonName','qrPersonMeta','qrCanvas','closeQr','printQr','labelsDialog','labelsStatus','labelsGrid','closeLabels','printLabels','toast'];
  ids.forEach(id => els[id] = $(id));

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved ? { ...defaultState, ...saved, settings: { ...defaultState.settings, ...(saved.settings || {}) } } : structuredClone(defaultState);
    } catch { return structuredClone(defaultState); }
  }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  const clean = value => String(value ?? '').trim();
  const normalized = value => clean(value).replace(/\s+/g, '').toLowerCase();
  const dateKey = value => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const todayKey = () => dateKey(new Date());
  const formatNumber = value => new Intl.NumberFormat('es-CO').format(value || 0);
  const formatDate = value => new Intl.DateTimeFormat('es-CO',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value));
  const formatTime = value => new Intl.DateTimeFormat('es-CO',{hour:'2-digit',minute:'2-digit'}).format(new Date(value));
  const initial = name => clean(name).charAt(0).toUpperCase() || '?';
  const escapeCsv = value => `"${String(value ?? '').replaceAll('"','""')}"`;

  function toast(message) {
    els.toast.textContent = message; els.toast.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => els.toast.classList.remove('show'), 2600);
  }
  function setFeedback(type, title, detail) {
    const icon = type === 'success' ? '✓' : type === 'error' ? '!' : '→';
    els.registerFeedback.className = `feedback ${type}`;
    els.registerFeedback.replaceChildren();
    const iconEl = document.createElement('span'); iconEl.className='feedback-icon'; iconEl.textContent=icon;
    const text = document.createElement('div'); const strong=document.createElement('strong'); const span=document.createElement('span');
    strong.textContent=title; span.textContent=detail; text.append(strong,span); els.registerFeedback.append(iconEl,text);
  }
  function updateNetwork() {
    const online = navigator.onLine; els.networkDot.classList.toggle('offline', !online); els.networkText.textContent = online ? 'En línea' : 'Sin conexión';
    if (online && state.settings.autoSync && state.settings.syncUrl) syncPending(true);
  }
  function showView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    if (name === 'summary') renderSummary();
    if (name === 'people') renderPeople();
    if (name === 'settings') fillSettings();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function findPerson(value) { const needle=normalized(value); return state.people.find(p => normalized(p.cedula)===needle || normalized(p.codigo)===needle); }

  async function registerScan(rawValue) {
    const value=clean(rawValue); const person=findPerson(value);
    if (!person) { setFeedback('error','Persona no encontrada',`No existe una persona con el código ${value}.`); toast('Persona no encontrada'); return; }
    const now=new Date(); const wait=Number(state.settings.duplicateSeconds)||0;
    const last=state.records.find(r => r.personId===person.id);
    if (last && (now-new Date(last.timestamp))/1000 < wait) {
      const remaining=Math.ceil(wait-(now-new Date(last.timestamp))/1000);
      setFeedback('error','Lectura repetida',`Espera ${remaining} segundo${remaining===1?'':'s'} para registrar de nuevo.`); return;
    }
    const trays=Math.max(1,Number(els.trayCount.value)||1); const cuttings=trays*(Number(state.settings.cuttingsPerTray)||130);
    const record={id:crypto.randomUUID(),timestamp:now.toISOString(),module:'Enraizamiento',personId:person.id,codigo:person.codigo,cedula:person.cedula,persona:person.nombre,trays,cuttings,origin:els.origin.value,synced:false};
    state.records.unshift(record); saveState();
    const personToday=state.records.filter(r=>r.personId===person.id&&dateKey(r.timestamp)===todayKey()).reduce((s,r)=>s+r.trays,0);
    setFeedback('success',person.nombre,`${trays} bandeja${trays===1?'':'s'} · ${formatNumber(cuttings)} esquejes. Hoy lleva ${personToday}.`);
    els.scanCode.value=''; els.scanCode.focus(); renderAll();
    if(navigator.onLine&&state.settings.autoSync&&state.settings.syncUrl) await syncPending(true);
  }

  function renderToday() {
    const records=state.records.filter(r=>dateKey(r.timestamp)===todayKey());
    const trays=records.reduce((s,r)=>s+r.trays,0); const cuttings=records.reduce((s,r)=>s+r.cuttings,0); const people=new Set(records.map(r=>r.personId)).size;
    els.todayTrays.textContent=formatNumber(trays); els.todayCuttings.textContent=`${formatNumber(cuttings)} esquejes`; els.todayPeople.textContent=`${people} persona${people===1?'':'s'} activa${people===1?'':'s'}`;
    const pending=state.records.filter(r=>!r.synced).length; els.pendingCount.textContent=`${pending} pendiente${pending===1?'':'s'}`;
  }
  function renderRecent() {
    els.recentRecords.replaceChildren(); const records=state.records.slice(0,6);
    if(!records.length){els.recentRecords.className='record-list empty-state';els.recentRecords.textContent='Todavía no hay registros.';return}
    els.recentRecords.className='record-list';
    records.forEach(r=>{const row=document.createElement('div');row.className='record-item';const avatar=document.createElement('span');avatar.className='record-avatar';avatar.textContent=initial(r.persona);const main=document.createElement('div');main.className='record-main';const strong=document.createElement('strong');strong.textContent=r.persona;const meta=document.createElement('span');meta.textContent=`${r.origin} · ${formatTime(r.timestamp)}`;main.append(strong,meta);const side=document.createElement('div');side.className='record-side';const qty=document.createElement('strong');qty.textContent=`${r.trays} bandeja${r.trays===1?'':'s'}`;const cut=document.createElement('span');cut.textContent=`${formatNumber(r.cuttings)} esquejes`;side.append(qty,cut);row.append(avatar,main,side);els.recentRecords.append(row)});
  }
  function renderPeople() {
    els.peopleTable.replaceChildren(); els.peopleTotal.textContent=state.people.length; els.peopleEmpty.hidden=state.people.length>0;
    state.people.slice().sort((a,b)=>a.nombre.localeCompare(b.nombre)).forEach(p=>{const tr=document.createElement('tr');[p.nombre,p.cedula,p.codigo].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td)});const action=document.createElement('td');const qr=document.createElement('button');qr.type='button';qr.className='table-action';qr.textContent='Ver QR';qr.addEventListener('click',()=>showQr(p));action.append(qr);tr.append(action);els.peopleTable.append(tr)});
  }
  function recordsForPeriod() {
    const period=els.summaryPeriod.value; if(period==='all')return state.records.slice();
    if(period==='today')return state.records.filter(r=>dateKey(r.timestamp)===todayKey());
    const since=new Date(); since.setHours(0,0,0,0); since.setDate(since.getDate()-(Number(period)-1)); return state.records.filter(r=>new Date(r.timestamp)>=since);
  }
  function renderSummary() {
    const records=recordsForPeriod(); const trays=records.reduce((s,r)=>s+r.trays,0); const cuttings=records.reduce((s,r)=>s+r.cuttings,0); const peopleIds=new Set(records.map(r=>r.personId));
    els.metricTrays.textContent=formatNumber(trays); els.metricCuttings.textContent=formatNumber(cuttings); els.metricPeople.textContent=peopleIds.size; els.metricAverage.textContent=peopleIds.size?(trays/peopleIds.size).toLocaleString('es-CO',{maximumFractionDigits:1}):'0'; els.goalLabel.textContent=`Meta: ${state.settings.dailyGoal}`;
    const totals=new Map(); records.forEach(r=>{const item=totals.get(r.personId)||{name:r.persona,trays:0,cuttings:0};item.trays+=r.trays;item.cuttings+=r.cuttings;totals.set(r.personId,item)});
    const ranked=[...totals.values()].sort((a,b)=>b.trays-a.trays); els.personBars.replaceChildren();
    if(!ranked.length){els.personBars.className='bars empty-state';els.personBars.textContent='No hay registros en este periodo.'}else{
      els.personBars.className='bars'; const max=Math.max(...ranked.map(x=>x.trays),Number(state.settings.dailyGoal)||1);
      ranked.forEach(item=>{const row=document.createElement('div');row.className='bar-row';const label=document.createElement('div');label.className='bar-label';const strong=document.createElement('strong');strong.textContent=item.name;const sub=document.createElement('span');sub.textContent=`${formatNumber(item.cuttings)} esquejes`;label.append(strong,sub);const track=document.createElement('div');track.className='bar-track';const fill=document.createElement('div');fill.className='bar-fill';fill.style.width=`${Math.min(100,item.trays/max*100)}%`;track.append(fill);const value=document.createElement('div');value.className='bar-value';value.textContent=item.trays;row.append(label,track,value);els.personBars.append(row)})}
    els.recordsTable.replaceChildren(); els.recordsEmpty.hidden=records.length>0;
    records.forEach(r=>{const tr=document.createElement('tr');[`${formatDate(r.timestamp)} ${formatTime(r.timestamp)}`,r.persona,r.origin,r.trays,formatNumber(r.cuttings)].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td)});const statusTd=document.createElement('td');const status=document.createElement('span');status.className=`status-chip ${r.synced?'sent':'pending'}`;status.textContent=r.synced?'Enviado':'Pendiente';statusTd.append(status);tr.append(statusTd);els.recordsTable.append(tr)});
  }
  function fillSettings(){els.cuttingsPerTray.value=state.settings.cuttingsPerTray;els.duplicateSeconds.value=state.settings.duplicateSeconds;els.dailyGoal.value=state.settings.dailyGoal;els.syncUrl.value=state.settings.syncUrl;els.autoSync.checked=Boolean(state.settings.autoSync);els.labelWidth.value=state.settings.labelWidth;els.labelHeight.value=state.settings.labelHeight;els.labelQrSize.value=state.settings.labelQrSize;els.labelColumns.value=state.settings.labelColumns;els.labelGap.value=state.settings.labelGap}
  function renderAll(){renderToday();renderRecent();renderPeople();renderSummary()}

  function parseCsv(text){
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(ch==='"'&&quoted&&next==='"'){cell+='"';i++}else if(ch==='"'){quoted=!quoted}else if(ch===','&&!quoted){row.push(cell);cell=''}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(cell);if(row.some(v=>clean(v)))rows.push(row);row=[];cell=''}else cell+=ch}
    row.push(cell);if(row.some(v=>clean(v)))rows.push(row);return rows;
  }
  async function importPeople(file){
    let rows=[];
    try{
      if(file.name.toLowerCase().endsWith('.csv')) rows=parseCsv(await file.text());
      else{
        if(!window.XLSX){toast('Conéctate a internet una vez para habilitar archivos Excel');return}
        const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'});const sheet=workbook.Sheets[workbook.SheetNames[0]];rows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:''});
      }
    }catch{toast('No se pudo leer el archivo');return}
    if(rows.length<2){toast('El archivo no contiene datos');return}
    const headers=rows[0].map(h=>clean(h).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());const nameIndex=headers.findIndex(h=>h==='nombre'||h==='persona');const idIndex=headers.findIndex(h=>h==='cedula'||h==='documento');const codeIndex=headers.findIndex(h=>h==='codigo');
    if(nameIndex<0||idIndex<0||codeIndex<0){toast('Faltan las columnas Nombre, Cédula o Código');return}
    let added=0;rows.slice(1).forEach(cols=>{const nombre=clean(cols[nameIndex]),cedula=clean(cols[idIndex]),codigo=clean(cols[codeIndex]);if(!nombre||!cedula||!codigo)return;if(state.people.some(p=>normalized(p.cedula)===normalized(cedula)||normalized(p.codigo)===normalized(codigo)))return;state.people.push({id:crypto.randomUUID(),nombre,cedula,codigo});added++});saveState();renderPeople();toast(`${added} persona${added===1?'':'s'} importada${added===1?'':'s'}`);
  }
  function exportCsv(){
    const headers=['Fecha','Hora','Código','Cédula','Persona','Bandejas','Esquejes','Origen','Estado'];const lines=[headers.map(escapeCsv).join(',')];
    state.records.slice().reverse().forEach(r=>lines.push([formatDate(r.timestamp),formatTime(r.timestamp),r.codigo,r.cedula,r.persona,r.trays,r.cuttings,r.origin,r.synced?'Enviado':'Pendiente'].map(escapeCsv).join(',')));
    const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`EnraizaCV-${todayKey()}.csv`;a.click();URL.revokeObjectURL(url);toast('Archivo CSV generado');
  }
  function exportExcel(){
    if(!window.XLSX){exportCsv();return}
    const records=state.records.slice().reverse().map(r=>({Fecha:formatDate(r.timestamp),Hora:formatTime(r.timestamp),'Hora del día':new Date(r.timestamp).getHours(),Módulo:r.module||'Enraizamiento','Código':r.codigo,'Cédula':r.cedula,Persona:r.persona,Bandejas:r.trays,Esquejes:r.cuttings,Origen:r.origin,Estado:r.synced?'Enviado':'Pendiente'}));
    const totals=new Map();state.records.forEach(r=>{const key=`${dateKey(r.timestamp)}|${r.personId}`;const item=totals.get(key)||{Fecha:dateKey(r.timestamp),'Código':r.codigo,'Cédula':r.cedula,Persona:r.persona,Bandejas:0,Esquejes:0};item.Bandejas+=r.trays;item.Esquejes+=r.cuttings;totals.set(key,item)});
    const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(records),'Registros');XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([...totals.values()]),'Resumen diario');XLSX.writeFile(book,`EnraizaCV-${todayKey()}.xlsx`);toast('Archivo Excel generado');
  }

  function renderLabels(){
    els.labelsGrid.replaceChildren();els.labelsGrid.style.setProperty('--label-columns',state.settings.labelColumns);els.labelsGrid.style.setProperty('--label-width',`${state.settings.labelWidth}mm`);els.labelsGrid.style.setProperty('--label-height',`${state.settings.labelHeight}mm`);els.labelsGrid.style.setProperty('--label-gap',`${state.settings.labelGap}mm`);
    if(!state.people.length){els.labelsStatus.textContent='No hay personas registradas.';return}
    if(!window.QRCode){els.labelsStatus.textContent='Conéctate a internet una vez para cargar el generador QR.';return}
    els.labelsStatus.textContent=`${state.people.length} sticker${state.people.length===1?'':'s'} listo${state.people.length===1?'':'s'} para imprimir.`;
    state.people.slice().sort((a,b)=>a.nombre.localeCompare(b.nombre)).forEach(person=>{const card=document.createElement('article');card.className='label-card';const qr=document.createElement('div');qr.className='label-qr';const copy=document.createElement('div');copy.className='label-copy';const name=document.createElement('strong');name.textContent=person.nombre;const id=document.createElement('span');id.textContent=`C.C. ${person.cedula}`;const code=document.createElement('span');code.textContent=`Código ${person.codigo}`;copy.append(name,id,code);card.append(qr,copy);els.labelsGrid.append(card);new QRCode(qr,{text:person.cedula,width:Number(state.settings.labelQrSize),height:Number(state.settings.labelQrSize),colorDark:'#0b3027',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H})});
  }
  function showAllLabels(){renderLabels();els.labelsDialog.showModal()}
  async function syncPending(silent=false){
    if(!state.settings.syncUrl){if(!silent)toast('Primero configura la URL de Google Sheets');return}if(!navigator.onLine){if(!silent)toast('No hay conexión a internet');return}const pending=state.records.filter(r=>!r.synced);if(!pending.length){if(!silent)toast('No hay registros pendientes');return}
    els.syncButton.disabled=true;els.syncStatus.textContent=`Enviando ${pending.length} registro${pending.length===1?'':'s'}…`;let sent=0;
    for(const record of pending){try{await fetch(state.settings.syncUrl,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({id:record.id,fecha:formatDate(record.timestamp),hora:formatTime(record.timestamp),timestamp:record.timestamp,modulo:record.module||'Enraizamiento',codigo:record.codigo,cedula:record.cedula,persona:record.persona,bandejas:record.trays,esquejes:record.cuttings,origen:record.origin})});record.synced=true;sent++}catch{break}}
    saveState();els.syncButton.disabled=false;els.syncStatus.textContent=`${sent} enviado${sent===1?'':'s'}; ${pending.length-sent} pendiente${pending.length-sent===1?'':'s'}.`;renderAll();if(!silent)toast(sent===pending.length?'Sincronización terminada':'Sincronización incompleta');
  }

  async function openCamera(){
    if(!('BarcodeDetector'in window)){toast('Este navegador no admite lectura por cámara. Usa la pistola o escribe el código.');return}
    try{cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});els.cameraVideo.srcObject=cameraStream;await els.cameraVideo.play();els.cameraDialog.showModal();const detector=new BarcodeDetector({formats:['qr_code']});
      const detect=async()=>{if(!cameraStream)return;try{const codes=await detector.detect(els.cameraVideo);if(codes.length){const value=codes[0].rawValue;closeCamera();await registerScan(value);return}}catch{}cameraLoop=requestAnimationFrame(detect)};detect();
    }catch{toast('No se pudo abrir la cámara. Revisa el permiso del navegador.')}
  }
  function closeCamera(){if(cameraLoop)cancelAnimationFrame(cameraLoop);cameraLoop=null;if(cameraStream)cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;if(els.cameraDialog.open)els.cameraDialog.close()}
  function showQr(person){els.qrPersonName.textContent=person.nombre;els.qrPersonMeta.textContent=`Cédula: ${person.cedula} · Código: ${person.codigo}`;els.qrCanvas.replaceChildren();if(window.QRCode)new QRCode(els.qrCanvas,{text:person.cedula,width:220,height:220,colorDark:'#0b3027',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H});else els.qrCanvas.textContent='Conéctate a internet una vez para cargar el generador de QR.';els.qrDialog.showModal()}

  els.scanForm.addEventListener('submit',e=>{e.preventDefault();registerScan(els.scanCode.value)});
  els.personForm.addEventListener('submit',e=>{e.preventDefault();const nombre=clean(els.personName.value),cedula=clean(els.personId.value),codigo=clean(els.personCode.value);if(state.people.some(p=>normalized(p.cedula)===normalized(cedula)||normalized(p.codigo)===normalized(codigo))){toast('La cédula o el código ya están registrados');return}state.people.push({id:crypto.randomUUID(),nombre,cedula,codigo});saveState();els.personForm.reset();renderPeople();toast('Persona guardada')});
  els.peopleImport.addEventListener('change',()=>{if(els.peopleImport.files[0])importPeople(els.peopleImport.files[0]);els.peopleImport.value=''});
  els.summaryPeriod.addEventListener('change',renderSummary);els.exportButton.addEventListener('click',exportExcel);
  els.settingsForm.addEventListener('submit',e=>{e.preventDefault();state.settings.cuttingsPerTray=Math.max(1,Number(els.cuttingsPerTray.value)||130);state.settings.duplicateSeconds=Math.max(0,Number(els.duplicateSeconds.value)||0);state.settings.dailyGoal=Math.max(1,Number(els.dailyGoal.value)||5);saveState();renderAll();toast('Configuración guardada')});
  els.syncForm.addEventListener('submit',e=>{e.preventDefault();state.settings.syncUrl=clean(els.syncUrl.value);state.settings.autoSync=els.autoSync.checked;saveState();toast('Conexión guardada')});
  els.labelSettingsForm.addEventListener('submit',e=>{e.preventDefault();state.settings.labelWidth=Math.max(25,Number(els.labelWidth.value)||52);state.settings.labelHeight=Math.max(25,Number(els.labelHeight.value)||38);state.settings.labelQrSize=Math.max(70,Number(els.labelQrSize.value)||110);state.settings.labelColumns=Math.max(1,Number(els.labelColumns.value)||3);state.settings.labelGap=Math.max(0,Number(els.labelGap.value)||4);saveState();toast('Formato de stickers guardado')});
  els.syncButton.addEventListener('click',()=>syncPending(false));
  els.clearRecordsButton.addEventListener('click',()=>{if(confirm('¿Eliminar todos los registros guardados en este dispositivo? Esta acción no se puede deshacer.')){state.records=[];saveState();renderAll();toast('Registros eliminados')}});
  els.cameraButton.addEventListener('click',openCamera);els.closeCamera.addEventListener('click',closeCamera);els.cameraDialog.addEventListener('close',closeCamera);
  els.closeQr.addEventListener('click',()=>els.qrDialog.close());els.printQr.addEventListener('click',()=>window.print());
  els.printAllQrButton.addEventListener('click',showAllLabels);els.closeLabels.addEventListener('click',()=>els.labelsDialog.close());els.printLabels.addEventListener('click',()=>window.print());
  document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.go)));
  window.addEventListener('online',updateNetwork);window.addEventListener('offline',updateNetwork);
  els.todayLabel.textContent=new Intl.DateTimeFormat('es-CO',{weekday:'long',day:'numeric',month:'long'}).format(new Date());fillSettings();updateNetwork();renderAll();els.scanCode.focus();
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
