const ESQUEJES_POR_CAMA=4160;

function renderProgramas(){
  selects();
  let ks=keys(),e=$('listaProgramas');
  if(!ks.length){e.innerHTML='<div class="vacio">Todavía no hay programas cargados.</div>';return}
  e.innerHTML=ks.map(k=>{
    let p=db.programas[k],t=totals(p),ac=String(db.activo)===k;
    return `<div class="programa-item"><div class="programa-top"><div><div class="programa-titulo">Programa Semana ${k} ${ac?'<span class="badge ok">Activo</span>':''}</div><div class="programa-meta">${p.items.length} líneas · ${fc(t.plan)} camas programadas</div><div class="programa-meta">Avance: ${fc(t.ap)} / ${fc(t.plan)} · ${t.ok}/${t.lineas} completas</div></div><div class="programa-acciones"><button class="btn-s btn-chico" onclick="activarSemana('${k}')">Usar</button><button class="btn-d btn-chico" onclick="eliminarSemana('${k}')">✕</button></div></div></div>`
  }).join('')
}

function kpis(t){
  return `<div class="kpi"><div class="v">${fc(t.plan)}</div><div class="t">Camas programadas</div></div><div class="kpi"><div class="v">${fc(t.ap)}</div><div class="t">Contabilizadas</div></div><div class="kpi"><div class="v">${fc(t.pend)}</div><div class="t">Pendientes</div></div><div class="kpi"><div class="v">${t.ok}/${t.lineas}</div><div class="t">Líneas completas</div></div>`
}

function renderRegistro(){
  selects();
  let p=activo(),e=$('listaItems');
  if(!p){$('kpisRegistro').innerHTML='';e.innerHTML='<div class="card vacio">Carga primero un programa.</div>';return}
  $('selSemana').value=String(db.activo);
  $('kpisRegistro').innerHTML=kpis(totals(p));
  let q=norm($('buscar').value),items=p.items.filter(i=>!q||norm(i.variedad).includes(q)||norm(i.nro).includes(q));
  e.innerHTML=items.map(i=>itemHTML(i)).join('')||'<div class="card vacio">Sin coincidencias.</div>'
}

function estadoCancelacion(i){
  const ms=i.movimientos||[];
  const canceladas=ms.filter(m=>m.tipo==='cancelacion').reduce((s,m)=>s+n(m.camas),0);
  return {hay:canceladas>0.0005,total:canceladas>=n(i.camasProg)-0.0005};
}

function itemHTML(i){
  let r=restante(i),ok=r<=.0005,pct=n(i.camasProg)?Math.min(100,aplicado(i)/n(i.camasProg)*100):100,m=(i.movimientos||[]).map(x=>movHTML(i,x)).join('');
  const canc=estadoCancelacion(i);
  let estado='Pendiente',clase='warn';
  if(canc.total){estado='Cancelada';clase='cancel'}
  else if(ok){estado='Completo';clase='ok'}
  else if(canc.hay){estado='Con cancelación';clase='cancel'}
  return `<div class="item ${ok?'completo':''} ${canc.hay?'cancelada':''}"><div class="item-top"><div><div class="item-var">${esc(i.variedad)}</div><div class="programa-meta">Nro. ${esc(i.nro||'—')} · ${esc(i.prod||'')}</div><div class="item-plan">Programado: <b>${fc(i.camasProg)} camas</b> · ${fmt(i.esquejesProg)} esquejes</div></div><div class="item-status"><span class="badge ${clase}">${estado}</span><div class="restante">${ok?'0':fc(r)} camas</div></div></div><div class="progress"><div style="width:${pct}%"></div></div><button class="${ok?'btn-n':'btn-p'} btn-full" ${ok?'disabled':''} onclick="abrirModal('${i.id}')">${ok?'✓ Total programado cumplido':'＋ Agregar movimiento'}</button>${m?'<div class="mov-lista">'+m+'</div>':''}</div>`
}

function tipoNombre(t){
  return{siembra:'Siembra normal',generacion:'Generación diferente',sustitucion:'Sustitución',cancelacion:'Cancelación'}[t]||t
}

function movHTML(i,m){
  let d=`${fc(m.camas)} camas`;
  if(m.fecha)d+=` · ${m.fecha}`;
  if(m.clon)d+=` · ${esc(m.clon)}`;
  if(m.esquejes)d+=` · ${fmt(m.esquejes)} esq.`;
  if(m.faltantes)d+=` · ${fmt(m.faltantes)} falt.`;
  if(m.bloque||m.cama)d+=` · B${esc(m.bloque||'—')} / C${esc(m.cama||'—')}`;
  if(m.sustituto)d+=` · Sust. ${esc(m.sustituto)}`;
  if(m.obs)d+=` · ${esc(m.obs)}`;
  return `<div class="mov ${m.tipo==='cancelacion'?'mov-cancelada':''}"><div class="mov-top"><div><div class="mov-tipo">${tipoNombre(m.tipo)}</div><div class="mov-det">${d}</div></div><div class="mov-acciones"><button class="btn-s btn-chico" onclick="abrirModal('${i.id}','${m.id}')">✎</button><button class="btn-d btn-chico" onclick="borrarMovimiento('${i.id}','${m.id}')">🗑</button></div></div></div>`
}

function buscarItem(id){return activo()?.items.find(i=>i.id===id)}

function abrirModal(id,mid=null){
  let i=buscarItem(id),m=mid?(i.movimientos||[]).find(x=>x.id===mid):null;
  if(!i)return;
  itemActual=id;movEditando=mid;
  let r=restante(i,mid);
  $('modalTitulo').textContent=m?'Editar movimiento':'Registrar movimiento';
  $('modalSub').textContent=i.variedad;
  $('modalPlan').innerHTML=`Programado: <b>${fc(i.camasProg)} camas</b> / ${fmt(i.esquejesProg)} esquejes<br>Disponible: <b>${fc(r)} camas</b>`;
  $('movTipo').value=m?.tipo||'siembra';
  $('movClon').value=m?.clon||'';
  $('movSust').value=m?.sustituto||'';
  $('movFecha').value=m?.fecha||new Date().toISOString().slice(0,10);
  $('movCamas').value=m?.camas??'';
  $('movFaltantes').value=m?.faltantes??'';
  $('movBloque').value=m?.bloque||'';
  $('movCama').value=m?.cama||'';
  $('movObs').value=m?.obs||'';
  $('movError').classList.remove('ver');
  tipoCambio();
  recalcularEsquejes(m?.esquejes);
  $('modalMov').classList.add('ver')
}

function cerrarModal(){$('modalMov').classList.remove('ver');itemActual=movEditando=null}
function cerrarSiFondo(e){if(e.target===$('modalMov'))cerrarModal()}

function tipoCambio(){
  let t=$('movTipo').value;
  $('grupoSust').style.display=t==='sustitucion'?'block':'none';
  let e=$('movInfo');
  if(t==='cancelacion'){
    e.textContent='La cancelación consume camas pendientes, deja los esquejes reales en 0 y la variedad se mostrará en rojo.';
    e.classList.add('ver')
  }else{
    e.textContent='Esquejes reales = (camas × 4.160) − faltantes.';
    e.classList.add('ver')
  }
  recalcularEsquejes()
}

function recalcularEsquejes(valorExistente){
  const t=$('movTipo').value;
  const camas=n($('movCamas').value);
  const falt=n($('movFaltantes').value);
  let esq=t==='cancelacion'?0:Math.max(0,Math.round(camas*ESQUEJES_POR_CAMA-falt));
  if(valorExistente!==undefined&&valorExistente!==null&&$('movCamas').value==='')esq=n(valorExistente);
  $('movEsquejes').value=esq||'';
}

function validarCamasLive(){
  let i=buscarItem(itemActual);if(!i)return;
  let max=restante(i,movEditando),v=n($('movCamas').value),e=$('movError');
  if(v>max+.0005){e.textContent=`Solo quedan ${fc(max)} camas disponibles.`;e.classList.add('ver')}else e.classList.remove('ver');
  recalcularEsquejes()
}

function guardarMovimiento(){
  let i=buscarItem(itemActual),max=restante(i,movEditando),c=n($('movCamas').value),t=$('movTipo').value,e=$('movError');
  if(c<=0||c>max+.0005){e.textContent=c<=0?'Ingresa una cantidad de camas mayor que 0.':`Supera el total programado. Máximo: ${fc(max)} camas.`;e.classList.add('ver');return}
  recalcularEsquejes();
  let m={id:movEditando||uid(),tipo:t,clon:$('movClon').value.trim(),sustituto:$('movSust').value.trim(),fecha:$('movFecha').value,camas:c,esquejes:n($('movEsquejes').value),faltantes:n($('movFaltantes').value),bloque:$('movBloque').value.trim(),cama:$('movCama').value.trim(),obs:$('movObs').value.trim()};
  i.movimientos=i.movimientos||[];
  if(movEditando){let x=i.movimientos.findIndex(z=>z.id===movEditando);i.movimientos[x]=m}else i.movimientos.push(m);
  save();cerrarModal();renderRegistro();toast(restante(i)<=.0005?'✓ Total programado cumplido':'Movimiento guardado')
}

function borrarMovimiento(iid,mid){
  let i=buscarItem(iid);if(!i||!confirm('¿Eliminar este movimiento?'))return;
  i.movimientos=i.movimientos.filter(m=>m.id!==mid);save();renderRegistro()
}

function renderResumen(){
  selects();let k=$('selSemanaResumen').value||String(db.activo||''),p=db.programas[k];
  if(!p){$('kpisResumen').innerHTML='';$('tablaResumen').innerHTML='<div class="vacio">No hay programa.</div>';return}
  let t=totals(p);
  $('kpisResumen').innerHTML=`<div class="kpi"><div class="v">${fc(t.ap)}</div><div class="t">Camas contabilizadas</div></div><div class="kpi"><div class="v">${fmt(t.er)}</div><div class="t">Esquejes reales</div></div><div class="kpi"><div class="v">${fmt(t.fa)}</div><div class="t">Faltantes</div></div><div class="kpi"><div class="v">${t.ok}/${t.lineas}</div><div class="t">Líneas completas</div></div>`;
  $('tablaResumen').innerHTML=`<table><thead><tr><th>Variedad</th><th>Prog.</th><th>Contab.</th><th>Pend.</th><th>Esq. real</th><th>Falt.</th></tr></thead><tbody>${p.items.map(i=>{let er=0,fa=0;(i.movimientos||[]).forEach(m=>{er+=n(m.esquejes);fa+=n(m.faltantes)});let c=estadoCancelacion(i);return `<tr class="${c.hay?'fila-cancelada':''}"><td><b>${esc(i.variedad)}</b></td><td>${fc(i.camasProg)}</td><td>${fc(aplicado(i))}</td><td>${fc(restante(i))}</td><td>${fmt(er)}</td><td>${fmt(fa)}</td></tr>`}).join('')}</tbody></table>`
}

function excelDate(v){
  if(!v)return '';
  if(v instanceof Date)return v;
  const s=String(v).trim();
  const iso=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(iso)return new Date(+iso[1],+iso[2]-1,+iso[3]);
  return s;
}

function construirFilasExport(p){
  const base=[],extras=[];
  p.items.forEach(i=>{
    const ms=i.movimientos||[];
    const primero=ms[0]||null;
    base.push({item:i,mov:primero,extra:false});
    ms.slice(1).forEach(m=>extras.push({item:i,mov:m,extra:true}));
  });
  return base.concat(extras)
}

async function asegurarExcelJS(){
  if(typeof ExcelJS!=='undefined')return true;
  return new Promise(resolve=>{
    const existente=document.querySelector('script[data-exceljs]');
    if(existente){existente.addEventListener('load',()=>resolve(typeof ExcelJS!=='undefined'),{once:true});existente.addEventListener('error',()=>resolve(false),{once:true});return}
    const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';s.dataset.exceljs='1';s.onload=()=>resolve(true);s.onerror=()=>resolve(false);document.head.appendChild(s)
  })
}

async function exportarExcel(){
  let p=db.programas[$('selSemanaResumen').value];if(!p)return;
  if(!await asegurarExcelJS()){toast('No se pudo cargar el generador de Excel');return}
  const wb=new ExcelJS.Workbook();
  wb.creator='Programa de Enraizamiento';
  const ws=wb.addWorksheet(`SEMANA ${p.week}`,{pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9,margins:{left:0.2,right:0.2,top:0.35,bottom:0.35,header:0.1,footer:0.1}}});
  const headers=['NUEVA FECHA','PROD.','NRO.','VARIEDAD','CAMAS\nPROG.','ESQUEJES\nPROG.','CLON\nRECIBIDO','CAMAS\nRECEP.','FECHA RECEPCION','FIRMA RECIBIDO','FECHA REAL\nSIEMBRA','CAMAS REAL','ESQUEJE REAL','FALTANTES','BLOQUE','CAMA','NOVEDADES'];
  ws.mergeCells('A1:Q1');
  ws.getCell('A1').value='PROGRAMA DE ENRAIZAMIENTO';
  ws.getCell('A1').font={bold:true,size:18};
  ws.getCell('A1').alignment={horizontal:'center',vertical:'middle'};
  ws.getRow(1).height=28;
  ws.mergeCells('A2:Q2');
  ws.getCell('A2').value=`SEMANA ${p.week}`;
  ws.getCell('A2').font={bold:true,size:13};
  ws.getCell('A2').alignment={horizontal:'left',vertical:'middle'};
  ws.getRow(2).height=22;
  const hr=ws.getRow(4);headers.forEach((h,idx)=>{let c=hr.getCell(idx+1);c.value=h;c.font={bold:true,size:9};c.alignment={horizontal:'center',vertical:'middle',wrapText:true};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE7E6E6'}};c.border={top:{style:'thin'},left:{style:'thin'},bottom:{style:'thin'},right:{style:'thin'}}});
  hr.height=34;
  const widths=[14,12,7,24,10,12,14,10,14,18,14,11,12,10,9,18,25];
  widths.forEach((w,i)=>ws.getColumn(i+1).width=w);
  const filas=construirFilasExport(p);
  filas.forEach((f,idx)=>{
    const i=f.item,m=f.mov,r=ws.getRow(5+idx),cancel=m?.tipo==='cancelacion';
    const vals=[
      f.extra?'':(i.fecha||''),
      f.extra?'':(i.prod||''),
      f.extra?'':(i.nro||''),
      i.variedad||'',
      f.extra?'':n(i.camasProg),
      f.extra?'':n(i.esquejesProg),
      m?.clon||'',
      '',
      '',
      '',
      m?.fecha?excelDate(m.fecha):'',
      m?n(m.camas):'',
      m?n(m.esquejes):'',
      m?n(m.faltantes):'',
      m?.bloque||'',
      m?.cama||'',
      m?(m.tipo==='sustitucion'?`Sust. ${m.sustituto||''}${m.obs?' / '+m.obs:''}`:m.tipo==='generacion'?`Generación diferente${m.obs?' / '+m.obs:''}`:m.tipo==='cancelacion'?`CANCELADO${m.obs?' / '+m.obs:''}`:(m.obs||'')):''
    ];
    vals.forEach((v,cidx)=>{const c=r.getCell(cidx+1);c.value=v;c.font={size:9,bold:cancel&&cidx===3,color:cancel?{argb:'FFC62828'}:undefined};c.alignment={vertical:'middle',wrapText:true,horizontal:[4,5,7,11,12,13,14].includes(cidx)?'center':'left'};c.border={top:{style:'thin'},left:{style:'thin'},bottom:{style:'thin'},right:{style:'thin'}};if(cancel)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFEBEE'}}});
    if(r.getCell(1).value instanceof Date)r.getCell(1).numFmt='dd-mm-yy';
    if(r.getCell(11).value instanceof Date)r.getCell(11).numFmt='dd-mm-yy';
    r.getCell(5).numFmt='0.###';r.getCell(6).numFmt='#,##0';r.getCell(12).numFmt='0.###';r.getCell(13).numFmt='#,##0';r.getCell(14).numFmt='#,##0';
    r.height=24;
  });
  ws.views=[{state:'frozen',ySplit:4}];
  ws.autoFilter={from:'A4',to:`Q${Math.max(5,4+filas.length)}`};
  ws.pageSetup.printTitlesRow='1:4';
  ws.headerFooter.oddFooter='&CPrograma de Enraizamiento - Semana '+p.week;
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Programa_Enraizamiento_Sem_${p.week}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
}

function prepararUI(){
  const e=$('movEsquejes');if(e){e.readOnly=true;e.title='Se calcula automáticamente: camas × 4.160 − faltantes';e.style.background='#f3f3f3'}
  const f=$('movFaltantes');if(f)f.addEventListener('input',recalcularEsquejes);
  const st=document.createElement('style');st.textContent='.item.cancelada{border-left-color:var(--r);background:#fff8f8}.item.cancelada .item-var{color:var(--r)}.badge.cancel{background:var(--rc);color:var(--r)}.mov-cancelada{background:var(--rc);margin:6px -8px;padding:9px 8px;border-radius:9px}.mov-cancelada .mov-tipo{color:var(--r)}.fila-cancelada td{background:#fff1f1;color:#8b1a1a}';document.head.appendChild(st)
}

prepararUI();selects();renderProgramas();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});