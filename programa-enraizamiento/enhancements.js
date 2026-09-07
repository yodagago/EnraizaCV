// Reglas operativas v4: orden exacto, sustituciones, ubicación y adiciones manuales.
(function(){
  const _reconstruir = window.reconstruirDesdeServidor;

  // Conserva estrictamente el orden de PROGRAMAS y marca las adiciones manuales.
  window.reconstruirDesdeServidor = function(programRows=[],registroRows=[]){
    const anterior=String(db.activo||'');
    const programas={};
    for(const row of programRows){
      const [id,semana,fecha,prod,nro,variedad,camasProg,esquejesProg,archivo,fechaCarga]=row;
      if(semana===''||semana==null||!String(variedad||'').trim())continue;
      const k=String(semana);
      if(!programas[k])programas[k]={week:Number(semana)||semana,archivo:archivo||'',hoja:`SEMANA ${semana}`,items:[]};
      programas[k].items.push({
        id:String(id),nro:nro??'',variedad:String(variedad||''),fecha:fecha??'',prod:prod??'',
        camasProg:n(camasProg),esquejesProg:n(esquejesProg),archivo:archivo||'',fechaCarga:fechaCarga||'',movimientos:[]
      });
    }
    for(const row of registroRows){
      const [id,idPrograma,semana,nro,variedad,tipo,clon,sustituto,fecha,camas,esquejes,faltantes,bloque,cama,obs,fechaRegistro]=row;
      const p=programas[String(semana)];if(!p)continue;
      let item=p.items.find(x=>String(x.id)===String(idPrograma));
      if(!item)item=p.items.find(x=>String(x.nro)===String(nro)&&norm(x.variedad)===norm(variedad));
      if(!item)continue;
      item.movimientos.push({id:String(id),tipo:tipo||'siembra',clon:clon||'',sustituto:sustituto||'',fecha:fecha||'',camas:n(camas),esquejes:n(esquejes),faltantes:n(faltantes),bloque:bloque||'',cama:cama||'',obs:obs||'',fechaRegistro:fechaRegistro||''});
    }
    db.programas=programas;
    const ks=Object.keys(programas).sort((a,b)=>Number(b)-Number(a));
    db.activo=programas[anterior]?(Number(anterior)||anterior):(ks.length?(Number(ks[0])||ks[0]):null);
    save();
  };

  function padCamaToken(token){
    const t=String(token||'').trim();
    if(/^\d+$/.test(t))return String(Number(t)).padStart(2,'0');
    const r=t.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if(r)return `${String(Number(r[1])).padStart(2,'0')}-${String(Number(r[2])).padStart(2,'0')}`;
    return t;
  }

  window.formatearCamas = function(cama){
    return String(cama||'').split(',').map(padCamaToken).filter(Boolean).join(', ');
  };

  window.ubicacionTexto = function(bloque,cama){
    const b=String(bloque||'').trim(),c=formatearCamas(cama);
    if(!b&&!c)return '';
    if(b&&c)return `BL ${b} - CM ${c}`;
    if(b)return `BL ${b}`;
    return `CM ${c}`;
  };

  function fechaMs(v,def=0){
    if(v instanceof Date)return v.getTime();
    const t=Date.parse(String(v||''));
    return Number.isFinite(t)?t:def;
  }

  function reemplazoDe(m){return String(m?.clon||m?.sustituto||'').trim()}
  function txtCamas(v){return `${fc(v)} cama${Math.abs(n(v)-1)<.0005?'':'s'}`}
  function agregarObs(base,txt){return [base,txt].filter(Boolean).join(' / ')}

  // Bloque como lista 1–4 y vista previa automática de ubicación.
  function prepararUbicacion(){
    const viejo=document.getElementById('movBloque');
    if(viejo&&viejo.tagName!=='SELECT'){
      const s=document.createElement('select');s.id='movBloque';
      s.innerHTML='<option value="">Seleccionar…</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>';
      viejo.replaceWith(s);
    }
    const cama=document.getElementById('movCama');
    if(cama&&!document.getElementById('movUbicacionPreview')){
      const p=document.createElement('div');p.id='movUbicacionPreview';p.className='ubicacion-preview';p.textContent='Ubicación: —';
      cama.parentElement.appendChild(p);
    }
    const upd=()=>{const p=document.getElementById('movUbicacionPreview');if(p)p.textContent='Ubicación: '+(ubicacionTexto(document.getElementById('movBloque')?.value,document.getElementById('movCama')?.value)||'—')};
    document.getElementById('movBloque')?.addEventListener('change',upd);
    document.getElementById('movCama')?.addEventListener('input',upd);
    window.actualizarUbicacionPreview=upd;
  }

  const _tipoCambio=window.tipoCambio;
  window.tipoCambio=function(){
    _tipoCambio();
    const t=$('movTipo').value;
    const lab=$('movClon')?.parentElement?.querySelector('label');
    if(lab)lab.textContent=t==='sustitucion'?'Variedad / clon sustituto':'Clon / generación recibida';
    if(t==='sustitucion'){
      $('grupoSust').style.display='none';
      $('movInfo').textContent='La variedad sustituta se toma de este campo. Se creará una línea adicional al final del programa.';
      $('movInfo').classList.add('ver');
    }
    actualizarUbicacionPreview?.();
  };

  const _abrirModal=window.abrirModal;
  window.abrirModal=async function(id,mid=null){
    await _abrirModal(id,mid);
    if($('movTipo').value==='sustitucion'&&!$('movClon').value&&$('movSust').value)$('movClon').value=$('movSust').value;
    tipoCambio();actualizarUbicacionPreview?.();
  };

  const _guardarMovimiento=window.guardarMovimiento;
  window.guardarMovimiento=async function(){
    if($('movTipo').value==='sustitucion')$('movSust').value=$('movClon').value.trim();
    return _guardarMovimiento();
  };

  const _movHTML=window.movHTML;
  window.movHTML=function(i,m){
    let html=_movHTML(i,m),u=ubicacionTexto(m.bloque,m.cama);
    if(u)html=html.replace('</div><div class="mov-acciones">',` · <b>${esc(u)}</b></div><div class="mov-acciones">`);
    return html;
  };

  function filaVacia(i){
    return {item:i,variedad:i.variedad||'',fechaProg:i.fecha||'',prod:i.prod||'',nro:i.nro||'',camasProg:n(i.camasProg),esquejesProg:n(i.esquejesProg),clon:'',fechaReal:'',camasReal:'',esquejesReal:'',faltantes:'',bloque:'',cama:'',novedades:'',ubicacion:'',cancelada:false};
  }

  function aplicarMovimientoAFila(f,m){
    if(!m)return f;
    f.clon=m.clon||'';f.fechaReal=m.fecha||'';f.camasReal=n(m.camas);f.esquejesReal=n(m.esquejes);f.faltantes=n(m.faltantes);f.bloque=m.bloque||'';f.cama=formatearCamas(m.cama);f.ubicacion=ubicacionTexto(m.bloque,m.cama);f.novedades=agregarObs(f.novedades,m.obs||'');
    if(m.tipo==='generacion')f.novedades=agregarObs(f.novedades,'Generación diferente');
    if(m.tipo==='cancelacion'){f.cancelada=true;f.camasReal='';f.esquejesReal=0;f.faltantes='';f.bloque='';f.cama='';f.ubicacion='';f.novedades=agregarObs(f.novedades,`${txtCamas(m.camas)} cancelada${n(m.camas)>1?'s':''}`)}
    return f;
  }

  window.construirVistaPrograma=function(p){
    const originales=[],extras=[];
    let seq=0;
    for(const i of p.items){
      const esAdicion=String(i.archivo||'').toUpperCase()==='ADICION MANUAL';
      const ms=i.movimientos||[];
      const subs=ms.filter(m=>m.tipo==='sustitucion');
      const normales=ms.filter(m=>m.tipo!=='sustitucion');
      const base=filaVacia(i);
      const primero=normales[0]||null;
      if(primero)aplicarMovimientoAFila(base,primero);
      for(const s of subs){
        const rep=reemplazoDe(s)||'(sin definir)';
        base.novedades=agregarObs(base.novedades,`${txtCamas(s.camas)} Sust. por ${rep}`);
      }
      const baseObj={...base,_ts:fechaMs(i.fechaCarga,seq++),_tipo:esAdicion?'adicion':'original'};
      if(esAdicion)extras.push(baseObj);else originales.push(baseObj);

      normales.slice(1).forEach(m=>{
        const f=filaVacia(i);f.fechaProg='';f.prod='';f.nro='';f.camasProg='';f.esquejesProg='';aplicarMovimientoAFila(f,m);
        extras.push({...f,_ts:fechaMs(m.fechaRegistro,100000+seq++),_tipo:'movExtra'});
      });

      subs.forEach(m=>{
        const rep=reemplazoDe(m);
        const f={item:i,variedad:rep,fechaProg:'',prod:'',nro:'',camasProg:'',esquejesProg:'',clon:rep,fechaReal:m.fecha||'',camasReal:n(m.camas),esquejesReal:n(m.esquejes),faltantes:n(m.faltantes),bloque:m.bloque||'',cama:formatearCamas(m.cama),novedades:`${txtCamas(m.camas)} Sust. ${i.variedad}${m.obs?' / '+m.obs:''}`,ubicacion:ubicacionTexto(m.bloque,m.cama),cancelada:false,_ts:fechaMs(m.fechaRegistro,100000+seq++),_tipo:'sustitucion'};
        extras.push(f);
      });
    }
    extras.sort((a,b)=>a._ts-b._ts);
    return originales.concat(extras);
  };

  function renderVistaPrograma(){
    const cont=document.getElementById('vistaProgramaFinal');if(!cont)return;
    const k=$('selSemanaResumen').value||String(db.activo||''),p=db.programas[k];
    if(!p){cont.innerHTML='<div class="vacio">Sin programa.</div>';return}
    const filas=construirVistaPrograma(p);
    cont.innerHTML=`<table><thead><tr><th>#</th><th>Variedad</th><th>Clon recibido</th><th>Camas real</th><th>Esquejes</th><th>Faltantes</th><th>Ubicación</th><th>Novedades</th></tr></thead><tbody>${filas.map((f,idx)=>`<tr class="${f.cancelada?'fila-cancelada':''}"><td>${idx+1}</td><td><b>${esc(f.variedad)}</b></td><td>${esc(f.clon)}</td><td>${f.camasReal===''?'':fc(f.camasReal)}</td><td>${f.esquejesReal===''?'':fmt(f.esquejesReal)}</td><td>${f.faltantes===''?'':fmt(f.faltantes)}</td><td>${esc(f.ubicacion)}</td><td>${esc(f.novedades)}</td></tr>`).join('')}</tbody></table>`;
  }

  const _renderResumen=window.renderResumen;
  window.renderResumen=function(){_renderResumen();renderVistaPrograma()};

  // Exportación respetando el orden original y colocando todas las líneas nuevas al final.
  window.exportarExcel=async function(){
    const p=db.programas[$('selSemanaResumen').value];if(!p)return;
    if(!await asegurarExcelJS()){toast('No se pudo cargar el generador de Excel');return}
    const filas=construirVistaPrograma(p);
    const wb=new ExcelJS.Workbook();wb.creator='Programa de Enraizamiento';
    const ws=wb.addWorksheet(`SEMANA ${p.week}`,{pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9,margins:{left:0.2,right:0.2,top:0.35,bottom:0.35,header:0.1,footer:0.1}}});
    const headers=['NUEVA FECHA','PROD.','NRO.','VARIEDAD','CAMAS\nPROG.','ESQUEJES\nPROG.','CLON\nRECIBIDO','CAMAS\nRECEP.','FECHA RECEPCION','FIRMA RECIBIDO','FECHA REAL\nSIEMBRA','CAMAS REAL','ESQUEJE REAL','FALTANTES','BLOQUE','CAMA','NOVEDADES','UBICACIÓN'];
    ws.mergeCells('A1:R1');ws.getCell('A1').value='PROGRAMA DE ENRAIZAMIENTO';ws.getCell('A1').font={bold:true,size:18};ws.getCell('A1').alignment={horizontal:'center',vertical:'middle'};ws.getRow(1).height=28;
    ws.mergeCells('A2:R2');ws.getCell('A2').value=`SEMANA ${p.week}`;ws.getCell('A2').font={bold:true,size:13};ws.getCell('A2').alignment={horizontal:'left',vertical:'middle'};ws.getRow(2).height=22;
    const hr=ws.getRow(4);headers.forEach((h,idx)=>{const c=hr.getCell(idx+1);c.value=h;c.font={bold:true,size:9};c.alignment={horizontal:'center',vertical:'middle',wrapText:true};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE7E6E6'}};c.border={top:{style:'thin'},left:{style:'thin'},bottom:{style:'thin'},right:{style:'thin'}}});hr.height=34;
    [14,12,7,24,10,12,14,10,14,18,14,11,12,10,9,18,27,22].forEach((w,i)=>ws.getColumn(i+1).width=w);
    filas.forEach((f,idx)=>{
      const r=ws.getRow(5+idx);
      const vals=[f.fechaProg,f.prod,f.nro,f.variedad,f.camasProg,f.esquejesProg,f.clon,'','','',f.fechaReal?excelDate(f.fechaReal):'',f.camasReal,f.esquejesReal,f.faltantes,f.bloque,f.cama,f.novedades,f.ubicacion];
      vals.forEach((v,cidx)=>{const c=r.getCell(cidx+1);c.value=v;c.font={size:9,bold:f.cancelada&&cidx===3,color:f.cancelada?{argb:'FFC62828'}:undefined};c.alignment={vertical:'middle',wrapText:true,horizontal:[4,5,7,11,12,13,14].includes(cidx)?'center':'left'};c.border={top:{style:'thin'},left:{style:'thin'},bottom:{style:'thin'},right:{style:'thin'}};if(f.cancelada)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFEBEE'}}});
      if(r.getCell(11).value instanceof Date)r.getCell(11).numFmt='dd-mm-yy';
      r.getCell(5).numFmt='0.###';r.getCell(6).numFmt='#,##0';r.getCell(12).numFmt='0.###';r.getCell(13).numFmt='#,##0';r.getCell(14).numFmt='#,##0';r.height=24;
    });
    ws.views=[{state:'frozen',ySplit:4}];ws.autoFilter={from:'A4',to:`R${Math.max(5,4+filas.length)}`};ws.pageSetup.printTitlesRow='1:4';
    const buf=await wb.xlsx.writeBuffer(),blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Programa_Enraizamiento_Sem_${p.week}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };

  function crearUIAdicion(){
    const tab=document.getElementById('tab-programas');if(!tab||document.getElementById('cardAdicion'))return;
    const card=document.createElement('div');card.className='card';card.id='cardAdicion';card.setAttribute('data-admin-only','');
    card.innerHTML=`<h2>Agregar adición manual al programa</h2><div class="nota" style="margin-bottom:9px">La nueva línea se agrega al final del programa y conserva el orden en que la vas creando.</div><div class="fila"><div><label>Semana</label><select id="addSemana"></select></div><div><label>Nro. (opcional)</label><input id="addNro" placeholder="Ej: 65"></div></div><div class="fila"><div><label>Nueva fecha</label><input id="addFecha" type="date"></div><div><label>Prod.</label><input id="addProd" placeholder="Ej: POMPON"></div></div><label>Variedad</label><input id="addVariedad" placeholder="Ej: Nueva variedad-BG4"><div class="fila"><div><label>Camas programadas</label><input id="addCamas" type="number" min="0.001" step="0.001" inputmode="decimal" placeholder="Ej: 2"></div><div><label>Esquejes programados</label><input id="addEsquejes" readonly></div></div><button class="btn-p btn-full" style="margin-top:10px" onclick="guardarAdicionManual()">＋ Agregar al final del programa</button>`;
    const lista=document.getElementById('listaProgramas')?.closest('.card');
    if(lista)tab.insertBefore(card,lista);else tab.appendChild(card);
    document.getElementById('addCamas').addEventListener('input',()=>{document.getElementById('addEsquejes').value=Math.round(n(document.getElementById('addCamas').value)*ESQUEJES_POR_CAMA)||''});
    actualizarSelectAdicion();
  }

  window.actualizarSelectAdicion=function(){
    const s=document.getElementById('addSemana');if(!s)return;const ks=keys();s.innerHTML=ks.map(k=>`<option value="${k}">Programa Sem ${k}</option>`).join('');if(db.activo)s.value=String(db.activo);
  };

  window.guardarAdicionManual=async function(){
    const semana=document.getElementById('addSemana').value,variedad=document.getElementById('addVariedad').value.trim(),camas=n(document.getElementById('addCamas').value);
    if(!semana||!variedad||camas<=0){toast('Completa semana, variedad y camas');return}
    const item={id:uid(),fecha:document.getElementById('addFecha').value||'',prod:document.getElementById('addProd').value.trim(),nro:document.getElementById('addNro').value.trim(),variedad,camasProg:camas,esquejesProg:Math.round(camas*ESQUEJES_POR_CAMA)};
    try{
      syncEstado('Agregando línea…','cargando');await apiPost({accion:'guardarPrograma',semana:Number(semana)||semana,archivo:'ADICION MANUAL',items:[item]});await syncRemote(false);
      ['addNro','addFecha','addProd','addVariedad','addCamas','addEsquejes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});renderProgramas();actualizarSelectAdicion();toast('Adición agregada al final');
    }catch(err){console.error(err);syncEstado('Error al agregar','error');toast('No se pudo agregar la línea')}
  };

  function crearVistaFinal(){
    const tab=document.getElementById('tab-resumen');if(!tab||document.getElementById('vistaProgramaFinal'))return;
    const card=document.createElement('div');card.className='card';card.innerHTML='<h2>Vista del programa en orden final</h2><div class="help" style="margin-bottom:8px">Primero conserva exactamente el orden del Excel original. Las sustituciones, líneas adicionales y adiciones manuales aparecen después.</div><div id="vistaProgramaFinal" class="tabla-wrap"></div>';tab.appendChild(card);
  }

  function estilosExtra(){
    const st=document.createElement('style');st.textContent='.ubicacion-preview{font-size:11px;color:#1b5e20;background:#e8f5e9;border-radius:8px;padding:6px 8px;margin-top:5px}.linea-extra{border-left-color:#1976d2!important}.extra-titulo{font-size:12px;font-weight:800;color:#0d47a1;margin:12px 0 8px}';document.head.appendChild(st)
  }

  prepararUbicacion();crearUIAdicion();crearVistaFinal();estilosExtra();
  setTimeout(async()=>{await syncRemote(false);actualizarSelectAdicion();renderVistaPrograma()},250);
})();
