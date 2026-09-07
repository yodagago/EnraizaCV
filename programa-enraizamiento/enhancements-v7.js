// Fechas v7: usar solo YYYY-MM-DD en la app y mostrar programado en la vista final.
(function(){
  function soloFecha(v){
    if(!v)return '';
    if(v instanceof Date){
      const y=v.getFullYear(),m=String(v.getMonth()+1).padStart(2,'0'),d=String(v.getDate()).padStart(2,'0');
      return `${y}-${m}-${d}`;
    }
    const s=String(v).trim();
    const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m)return `${m[1]}-${m[2]}-${m[3]}`;
    const d=new Date(s);
    if(!isNaN(d)){
      const y=d.getFullYear(),mo=String(d.getMonth()+1).padStart(2,'0'),da=String(d.getDate()).padStart(2,'0');
      return `${y}-${mo}-${da}`;
    }
    return s;
  }

  window.excelDate=function(v){return soloFecha(v)};

  const renderAnterior=window.renderResumen;
  window.renderResumen=function(){
    renderAnterior();
    const k=$('selSemanaResumen').value||String(db.activo||''),p=db.programas[k];
    if(!p)return;

    const tabla=$('tablaResumen');
    if(tabla){
      tabla.innerHTML=`<table><thead><tr><th>Variedad</th><th>Fecha siembra</th><th>Prog.</th><th>Contab.</th><th>Pend.</th><th>Esq. real</th><th>Falt.</th></tr></thead><tbody>${p.items.map(i=>{
        let er=0,fa=0;(i.movimientos||[]).forEach(m=>{er+=n(m.esquejes);fa+=n(m.faltantes)});
        const fechas=[...new Set((i.movimientos||[]).filter(m=>m.tipo!=='cancelacion'&&m.fecha).map(m=>soloFecha(m.fecha)))].join(', ');
        const c=estadoCancelacion(i);
        return `<tr class="${c.hay?'fila-cancelada':''}"><td><b>${esc(i.variedad)}</b></td><td>${esc(fechas)}</td><td>${fc(i.camasProg)}</td><td>${fc(aplicado(i))}</td><td>${fc(restante(i))}</td><td>${fmt(er)}</td><td>${fmt(fa)}</td></tr>`
      }).join('')}</tbody></table>`;
    }

    const cont=document.getElementById('vistaProgramaFinal');
    if(cont&&typeof construirVistaPrograma==='function'){
      const filas=construirVistaPrograma(p);
      cont.innerHTML=`<table><thead><tr><th>#</th><th>Variedad</th><th>Camas prog.</th><th>Esquejes prog.</th><th>Clon recibido</th><th>Fecha siembra</th><th>Camas real</th><th>Esquejes</th><th>Faltantes</th><th>Ubicación</th><th>Novedades</th></tr></thead><tbody>${filas.map((f,idx)=>`<tr class="${f.cancelada?'fila-cancelada':''}"><td>${idx+1}</td><td><b>${esc(f.variedad)}</b></td><td>${f.camasProg===''?'':fc(f.camasProg)}</td><td>${f.esquejesProg===''?'':fmt(f.esquejesProg)}</td><td>${esc(f.clon)}</td><td>${esc(soloFecha(f.fechaReal))}</td><td>${f.camasReal===''?'':fc(f.camasReal)}</td><td>${f.esquejesReal===''?'':fmt(f.esquejesReal)}</td><td>${f.faltantes===''?'':fmt(f.faltantes)}</td><td>${esc(f.ubicacion)}</td><td>${esc(f.novedades)}</td></tr>`).join('')}</tbody></table>`;
    }
  };
})();
