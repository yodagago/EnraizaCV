const API_URL='https://script.google.com/macros/s/AKfycbzbH33MdjEB_xesopipqEdnhU7UViJax57l6csviysjBoO9AGqOszpYsz7z7H9uF6Vm/exec';
let sincronizando=false;

function syncEstado(txt,tipo=''){
  const e=document.getElementById('syncEstado');
  if(!e)return;
  e.textContent=txt;
  e.className='sync-estado '+tipo;
}

async function apiGet(accion){
  const r=await fetch(`${API_URL}?accion=${encodeURIComponent(accion)}&_=${Date.now()}`,{cache:'no-store',redirect:'follow'});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  const t=await r.text();
  let j;try{j=JSON.parse(t)}catch{throw new Error('Respuesta no válida de Apps Script')}
  if(j.ok===false)throw new Error(j.error||'Error de Apps Script');
  return j;
}

async function apiPost(payload){
  const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),redirect:'follow'});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  const t=await r.text();
  let j;try{j=JSON.parse(t)}catch{throw new Error('Respuesta no válida de Apps Script')}
  if(j.ok===false)throw new Error(j.error||'Error de Apps Script');
  return j;
}

function reconstruirDesdeServidor(programRows=[],registroRows=[]){
  const anterior=String(db.activo||'');
  const programas={};

  for(const row of programRows){
    const [id,semana,fecha,prod,nro,variedad,camasProg,esquejesProg,archivo]=row;
    if(semana===''||semana==null||!String(variedad||'').trim())continue;
    const k=String(semana);
    if(!programas[k])programas[k]={week:Number(semana)||semana,archivo:archivo||'',hoja:`SEMANA ${semana}`,items:[]};
    programas[k].items.push({
      id:String(id),
      nro:nro??'',
      variedad:String(variedad||''),
      fecha:fecha??'',
      prod:prod??'',
      camasProg:n(camasProg),
      esquejesProg:n(esquejesProg),
      movimientos:[]
    });
  }

  for(const row of registroRows){
    const [id,idPrograma,semana,nro,variedad,tipo,clon,sustituto,fecha,camas,esquejes,faltantes,bloque,cama,obs,fechaRegistro]=row;
    const p=programas[String(semana)];
    if(!p)continue;
    let item=p.items.find(x=>String(x.id)===String(idPrograma));
    if(!item)item=p.items.find(x=>String(x.nro)===String(nro)&&norm(x.variedad)===norm(variedad));
    if(!item)continue;
    item.movimientos.push({
      id:String(id),tipo:tipo||'siembra',clon:clon||'',sustituto:sustituto||'',fecha:fecha||'',
      camas:n(camas),esquejes:n(esquejes),faltantes:n(faltantes),bloque:bloque||'',cama:cama||'',obs:obs||'',fechaRegistro:fechaRegistro||''
    });
  }

  db.programas=programas;
  const ks=Object.keys(programas).sort((a,b)=>Number(b)-Number(a));
  db.activo=programas[anterior]?(Number(anterior)||anterior):(ks.length?(Number(ks[0])||ks[0]):null);
  save();
}

async function syncRemote(mostrarToast=false){
  if(sincronizando)return false;
  sincronizando=true;syncEstado('Sincronizando…','cargando');
  try{
    const [p,r]=await Promise.all([apiGet('programas'),apiGet('registros')]);
    reconstruirDesdeServidor(p.datos||[],r.datos||[]);
    selects();
    const activa=document.querySelector('.tab.activa')?.id;
    if(activa==='tab-programas')renderProgramas();
    if(activa==='tab-registro')renderRegistro();
    if(activa==='tab-resumen')renderResumen();
    syncEstado('Google Sheets conectado','ok');
    if(mostrarToast)toast('Datos actualizados');
    return true;
  }catch(err){
    console.error(err);syncEstado('Sin conexión · usando copia local','error');
    if(mostrarToast)toast('No se pudo actualizar');
    return false;
  }finally{sincronizando=false}
}

function registroPayload(i,m){
  return {
    id:m.id,
    idPrograma:i.id,
    semana:db.activo,
    nro:i.nro||'',
    variedad:i.variedad||'',
    tipo:m.tipo||'siembra',
    clon:m.clon||'',
    sustituto:m.sustituto||'',
    fecha:m.fecha||'',
    camas:n(m.camas),
    esquejes:n(m.esquejes),
    faltantes:n(m.faltantes),
    bloque:m.bloque||'',
    cama:m.cama||'',
    obs:m.obs||''
  };
}

const importarExcelLocal=window.importarExcel;
window.importarExcel=async function(ev){
  const f=ev.target.files?.[0];ev.target.value='';if(!f)return;
  try{
    syncEstado('Cargando programa…','cargando');
    await syncRemote(false);
    const wb=XLSX.read(await f.arrayBuffer(),{type:'array'});
    const pendientes=[];
    for(const sn of wb.SheetNames){
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:false});
      const p=parse(rows,sn,f.name);
      if(!p||!p.items.length)continue;
      const k=String(p.week);
      if(db.programas[k]||pendientes.some(x=>String(x.week)===k)){
        alert(`La Semana ${k} ya existe en Google Sheets. No se volvió a cargar para evitar duplicados.`);
        continue;
      }
      pendientes.push(p);
    }
    if(!pendientes.length){syncEstado('Google Sheets conectado','ok');toast('No encontré un programa nuevo');return}
    for(const p of pendientes){
      await apiPost({accion:'guardarPrograma',semana:p.week,archivo:f.name,items:p.items});
    }
    await syncRemote(false);
    renderProgramas();
    toast(pendientes.length===1?`Semana ${pendientes[0].week} cargada`:`${pendientes.length} programas cargados`);
  }catch(err){
    console.error(err);syncEstado('Error de conexión','error');toast('No se pudo cargar el programa')
  }
};

const abrirModalLocal=window.abrirModal;
window.abrirModal=async function(id,mid=null){
  await syncRemote(false);
  abrirModalLocal(id,mid);
};

window.guardarMovimiento=async function(){
  const idItem=itemActual,idMov=movEditando;
  if(!idItem)return;
  syncEstado('Validando…','cargando');
  await syncRemote(false);
  itemActual=idItem;movEditando=idMov;
  const i=buscarItem(idItem),e=$('movError');
  if(!i){e.textContent='Esta línea ya no está disponible. Actualiza la semana.';e.classList.add('ver');return}
  const max=restante(i,idMov),c=n($('movCamas').value),t=$('movTipo').value;
  if(c<=0||c>max+.0005){
    e.textContent=c<=0?'Ingresa una cantidad de camas mayor que 0.':`Supera el total programado. Máximo disponible: ${fc(max)} camas.`;
    e.classList.add('ver');syncEstado('Google Sheets conectado','ok');return;
  }
  recalcularEsquejes();
  const m={
    id:idMov||uid(),tipo:t,clon:$('movClon').value.trim(),sustituto:$('movSust').value.trim(),fecha:$('movFecha').value,
    camas:c,esquejes:n($('movEsquejes').value),faltantes:n($('movFaltantes').value),bloque:$('movBloque').value.trim(),cama:$('movCama').value.trim(),obs:$('movObs').value.trim()
  };
  const viejo=idMov?(i.movimientos||[]).find(x=>x.id===idMov):null;
  try{
    syncEstado('Guardando…','cargando');
    if(viejo){
      const del=await apiPost({accion:'eliminarRegistro',id:idMov});
      if(del.ok===false)throw new Error(del.error||'No se pudo actualizar');
    }
    try{
      await apiPost({accion:'guardarRegistro',registro:registroPayload(i,m)});
    }catch(err){
      if(viejo){try{await apiPost({accion:'guardarRegistro',registro:registroPayload(i,viejo)})}catch(_){} }
      throw err;
    }
    await syncRemote(false);cerrarModal();renderRegistro();
    const ii=buscarItem(idItem);
    toast(ii&&restante(ii)<=.0005?'✓ Total programado cumplido':'Movimiento guardado');
  }catch(err){
    console.error(err);e.textContent='No se pudo guardar en Google Sheets. Intenta nuevamente.';e.classList.add('ver');syncEstado('Error al guardar','error')
  }
};

window.borrarMovimiento=async function(iid,mid){
  if(!confirm('¿Eliminar este movimiento?'))return;
  try{
    syncEstado('Eliminando…','cargando');
    const r=await apiPost({accion:'eliminarRegistro',id:mid});
    if(r.ok===false)throw new Error(r.error||'No encontrado');
    await syncRemote(false);renderRegistro();toast('Movimiento eliminado');
  }catch(err){console.error(err);syncEstado('Error al eliminar','error');toast('No se pudo eliminar')}
};

window.eliminarSemana=function(){alert('Para evitar borrados accidentales, las semanas no se eliminan desde la app. Si necesitas eliminar o reemplazar una semana, hazlo desde Google Sheets.')};
window.cargarDemo=function(){alert('La demo está desactivada porque esta versión ya trabaja con Google Sheets.')};

function aplicarModo(){
  const modo=(new URLSearchParams(location.search).get('modo')||'admin').toLowerCase();
  document.body.dataset.modo=modo;
  const campo=modo==='campo';
  document.querySelectorAll('[data-admin-only]').forEach(e=>e.style.display=campo?'none':'');
  const b=document.getElementById('modoBadge');
  if(b)b.textContent=campo?'Modo campo':'Modo administrador';
  if(campo){
    const btn=document.querySelector('nav button[data-tab="registro"]');
    if(btn)nav('registro',btn);
  }
}

aplicarModo();
syncRemote(false);
setInterval(()=>{if(document.visibilityState==='visible')syncRemote(false)},60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncRemote(false)});
