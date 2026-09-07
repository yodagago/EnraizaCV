// Reglas operativas v5: generación como línea nueva, texto de cancelación y adiciones en modo campo.
(function(){
  function fechaMs(v,def=0){
    if(v instanceof Date)return v.getTime();
    const t=Date.parse(String(v||''));
    return Number.isFinite(t)?t:def;
  }
  function txtCamas(v){return `${fc(v)} cama${Math.abs(n(v)-1)<.0005?'':'s'}`}
  function agregarObs(base,txt){return [base,txt].filter(Boolean).join(' / ')}
  function reemplazoDe(m){return String(m?.clon||m?.sustituto||'').trim()}
  function variedadGeneracion(i,m){
    const raw=String(m?.clon||'').trim();
    if(!raw)return '';
    if(raw.includes('-'))return raw;
    const orig=String(i?.variedad||'').trim();
    const p=orig.lastIndexOf('-');
    return p>=0?orig.slice(0,p+1)+raw:(orig?orig+'-'+raw:raw);
  }
  function filaVacia(i){
    return {item:i,variedad:i.variedad||'',fechaProg:i.fecha||'',prod:i.prod||'',nro:i.nro||'',camasProg:n(i.camasProg),esquejesProg:n(i.esquejesProg),clon:'',fechaReal:'',camasReal:'',esquejesReal:'',faltantes:'',bloque:'',cama:'',novedades:'',ubicacion:'',cancelada:false};
  }
  function aplicarSiembra(f,m){
    f.clon=m.clon||'';
    f.fechaReal=m.fecha||'';
    f.camasReal=n(m.camas);
    f.esquejesReal=n(m.esquejes);
    f.faltantes=n(m.faltantes);
    f.bloque=m.bloque||'';
    f.cama=formatearCamas(m.cama);
    f.ubicacion=ubicacionTexto(m.bloque,m.cama);
    f.novedades=agregarObs(f.novedades,m.obs||'');
    return f;
  }

  // Si el operario escribe solo BG4/CG4, la app completa automáticamente Skylie-BG4, etc.
  const guardarAnterior=window.guardarMovimiento;
  window.guardarMovimiento=async function(){
    if($('movTipo').value==='generacion'){
      const i=buscarItem(itemActual),raw=$('movClon').value.trim();
      if(i&&raw)$('movClon').value=variedadGeneracion(i,{clon:raw});
    }
    return guardarAnterior();
  };

  const tipoAnterior=window.tipoCambio;
  window.tipoCambio=function(){
    tipoAnterior();
    const t=$('movTipo').value;
    const lab=$('movClon')?.parentElement?.querySelector('label');
    if(t==='generacion'){
      if(lab)lab.textContent='Nueva variedad / generación recibida';
      $('movInfo').textContent='Ejemplo: si el programa dice Skylie-CG4 y escribes BG4, se guardará como Skylie-BG4 y se creará una línea al final.';
      $('movInfo').classList.add('ver');
    }
  };

  // Vista final: la línea original conserva su posición; generaciones y sustituciones crean líneas al final.
  window.construirVistaPrograma=function(p){
    const originales=[],extras=[];
    let seq=0;
    for(const i of p.items){
      const esAdicion=String(i.archivo||'').toUpperCase()==='ADICION MANUAL';
      const ms=i.movimientos||[];
      const siembras=ms.filter(m=>m.tipo==='siembra');
      const gens=ms.filter(m=>m.tipo==='generacion');
      const subs=ms.filter(m=>m.tipo==='sustitucion');
      const cans=ms.filter(m=>m.tipo==='cancelacion');
      const base=filaVacia(i);

      // Una siembra normal se registra en la misma línea del programa.
      if(siembras[0])aplicarSiembra(base,siembras[0]);

      // Las novedades que modifican la programación se escriben sobre la línea original.
      for(const g of gens){
        base.novedades=agregarObs(base.novedades,`${txtCamas(g.camas)} de generación diferente`);
      }
      for(const s of subs){
        const rep=reemplazoDe(s)||'(sin definir)';
        base.novedades=agregarObs(base.novedades,`${txtCamas(s.camas)} Sust. por ${rep}`);
      }
      for(const c of cans){
        base.cancelada=true;
        base.novedades=agregarObs(base.novedades,`${txtCamas(c.camas)} cancelada${n(c.camas)>1?'s':''} del programa`);
      }

      const baseObj={...base,_ts:fechaMs(i.fechaCarga,seq++),_tipo:esAdicion?'adicion':'original'};
      if(esAdicion)extras.push(baseObj);else originales.push(baseObj);

      // Si una línea original tiene más de una siembra normal, las adicionales pasan al final.
      siembras.slice(1).forEach(m=>{
        const f=filaVacia(i);f.fechaProg='';f.prod='';f.nro='';f.camasProg='';f.esquejesProg='';aplicarSiembra(f,m);
        extras.push({...f,_ts:fechaMs(m.fechaRegistro,100000+seq++),_tipo:'siembraExtra'});
      });

      // Cambio de generación: nueva variedad al final, con variedad y clon recibido iguales.
      gens.forEach(m=>{
        const nueva=variedadGeneracion(i,m);
        const f={item:i,variedad:nueva,fechaProg:'',prod:'',nro:'',camasProg:'',esquejesProg:'',clon:nueva,fechaReal:m.fecha||'',camasReal:n(m.camas),esquejesReal:n(m.esquejes),faltantes:n(m.faltantes),bloque:m.bloque||'',cama:formatearCamas(m.cama),novedades:`${txtCamas(m.camas)} generación diferente de ${i.variedad}${m.obs?' / '+m.obs:''}`,ubicacion:ubicacionTexto(m.bloque,m.cama),cancelada:false,_ts:fechaMs(m.fechaRegistro,100000+seq++),_tipo:'generacion'};
        extras.push(f);
      });

      // Sustitución: nueva variedad al final.
      subs.forEach(m=>{
        const rep=reemplazoDe(m);
        const f={item:i,variedad:rep,fechaProg:'',prod:'',nro:'',camasProg:'',esquejesProg:'',clon:rep,fechaReal:m.fecha||'',camasReal:n(m.camas),esquejesReal:n(m.esquejes),faltantes:n(m.faltantes),bloque:m.bloque||'',cama:formatearCamas(m.cama),novedades:`${txtCamas(m.camas)} Sust. ${i.variedad}${m.obs?' / '+m.obs:''}`,ubicacion:ubicacionTexto(m.bloque,m.cama),cancelada:false,_ts:fechaMs(m.fechaRegistro,100000+seq++),_tipo:'sustitucion'};
        extras.push(f);
      });
    }
    extras.sort((a,b)=>a._ts-b._ts);
    return originales.concat(extras);
  };

  // Adición manual disponible también desde Registro / modo campo.
  function actualizarSemanasCampo(){
    const s=document.getElementById('campoAddSemana');
    if(!s)return;
    const actual=s.value,ks=keys();
    s.innerHTML=ks.map(k=>`<option value="${k}">Programa Sem ${k}</option>`).join('');
    if(actual&&db.programas[actual])s.value=actual;
    else if(db.activo)s.value=String(db.activo);
  }

  function crearAdicionCampo(){
    const tab=document.getElementById('tab-registro');
    if(!tab||document.getElementById('cardAdicionCampo'))return;
    const card=document.createElement('div');
    card.className='card';card.id='cardAdicionCampo';
    card.innerHTML=`
      <h2>＋ Adición al programa</h2>
      <div class="nota" style="margin-bottom:9px">Puedes agregar una variedad que no estaba en el programa inicial. Se ubicará al final según el orden en que se cree.</div>
      <div class="fila"><div><label>Semana</label><select id="campoAddSemana"></select></div><div><label>Nro. (opcional)</label><input id="campoAddNro" placeholder="Ej: 76"></div></div>
      <div class="fila"><div><label>Nueva fecha</label><input id="campoAddFecha" type="date"></div><div><label>Prod.</label><input id="campoAddProd" placeholder="Ej: POMPON"></div></div>
      <label>Variedad</label><input id="campoAddVariedad" placeholder="Ej: Nueva variedad-BG4">
      <div class="fila"><div><label>Camas programadas</label><input id="campoAddCamas" type="number" min="0.001" step="0.001" inputmode="decimal" placeholder="Ej: 2"></div><div><label>Esquejes programados</label><input id="campoAddEsquejes" readonly></div></div>
      <button class="btn-p btn-full" style="margin-top:10px" onclick="guardarAdicionCampo()">＋ Agregar al final del programa</button>`;
    const toolbar=tab.querySelector('.toolbar');
    if(toolbar)toolbar.insertAdjacentElement('afterend',card);else tab.prepend(card);
    document.getElementById('campoAddCamas').addEventListener('input',()=>{
      document.getElementById('campoAddEsquejes').value=Math.round(n(document.getElementById('campoAddCamas').value)*ESQUEJES_POR_CAMA)||'';
    });
    actualizarSemanasCampo();
  }

  window.guardarAdicionCampo=async function(){
    const semana=document.getElementById('campoAddSemana').value;
    const variedad=document.getElementById('campoAddVariedad').value.trim();
    const camas=n(document.getElementById('campoAddCamas').value);
    if(!semana||!variedad||camas<=0){toast('Completa semana, variedad y camas');return}
    const item={
      id:uid(),fecha:document.getElementById('campoAddFecha').value||'',prod:document.getElementById('campoAddProd').value.trim(),nro:document.getElementById('campoAddNro').value.trim(),
      variedad,camasProg:camas,esquejesProg:Math.round(camas*ESQUEJES_POR_CAMA)
    };
    try{
      syncEstado('Agregando línea…','cargando');
      await apiPost({accion:'guardarPrograma',semana:Number(semana)||semana,archivo:'ADICION MANUAL',items:[item]});
      await syncRemote(false);
      ['campoAddNro','campoAddFecha','campoAddProd','campoAddVariedad','campoAddCamas','campoAddEsquejes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});
      actualizarSemanasCampo();renderRegistro();toast('Adición agregada al final del programa');
    }catch(err){console.error(err);syncEstado('Error al agregar','error');toast('No se pudo agregar la línea')}
  };

  const syncAnterior=window.syncRemote;
  window.syncRemote=async function(...args){
    const r=await syncAnterior(...args);
    actualizarSemanasCampo();
    return r;
  };

  crearAdicionCampo();
  setTimeout(actualizarSemanasCampo,350);
})();
