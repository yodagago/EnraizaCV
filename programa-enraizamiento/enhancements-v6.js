// Resumen v6: mostrar fecha real de siembra.
(function(){
  function fechaBonita(v){
    if(!v)return '';
    if(v instanceof Date){
      const d=String(v.getDate()).padStart(2,'0'),m=String(v.getMonth()+1).padStart(2,'0');
      return `${d}-${m}-${v.getFullYear()}`;
    }
    const s=String(v).trim();
    const iso=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(iso)return `${iso[3]}-${iso[2]}-${iso[1]}`;
    return s;
  }

  function fechasItem(i){
    const arr=(i.movimientos||[])
      .filter(m=>m.tipo!=='cancelacion'&&m.fecha)
      .map(m=>fechaBonita(m.fecha));
    return [...new Set(arr)].join(', ');
  }

  const renderAnterior=window.renderResumen;
  window.renderResumen=function(){
    renderAnterior();
    const k=$('selSemanaResumen').value||String(db.activo||''),p=db.programas[k];
    if(!p)return;

    const tabla=$('tablaResumen');
    if(tabla){
      tabla.innerHTML=`<table><thead><tr><th>Variedad</th><th>Fecha siembra</th><th>Prog.</th><th>Contab.</th><th>Pend.</th><th>Esq. real</th><th>Falt.</th></tr></thead><tbody>${p.items.map(i=>{
        let er=0,fa=0;(i.movimientos||[]).forEach(m=>{er+=n(m.esquejes);fa+=n(m.faltantes)});
        let c=estadoCancelacion(i);
        return `<tr class="${c.hay?'fila-cancelada':''}"><td><b>${esc(i.variedad)}</b></td><td>${esc(fechasItem(i))}</td><td>${fc(i.camasProg)}</td><td>${fc(aplicado(i))}</td><td>${fc(restante(i))}</td><td>${fmt(er)}</td><td>${fmt(fa)}</td></tr>`
      }).join('')}</tbody></table>`;
    }

    const cont=document.getElementById('vistaProgramaFinal');
    if(cont&&typeof construirVistaPrograma==='function'){
      const filas=construirVistaPrograma(p);
      cont.innerHTML=`<table><thead><tr><th>#</th><th>Variedad</th><th>Clon recibido</th><th>Fecha siembra</th><th>Camas real</th><th>Esquejes</th><th>Faltantes</th><th>Ubicación</th><th>Novedades</th></tr></thead><tbody>${filas.map((f,idx)=>`<tr class="${f.cancelada?'fila-cancelada':''}"><td>${idx+1}</td><td><b>${esc(f.variedad)}</b></td><td>${esc(f.clon)}</td><td>${esc(fechaBonita(f.fechaReal))}</td><td>${f.camasReal===''?'':fc(f.camasReal)}</td><td>${f.esquejesReal===''?'':fmt(f.esquejesReal)}</td><td>${f.faltantes===''?'':fmt(f.faltantes)}</td><td>${esc(f.ubicacion)}</td><td>${esc(f.novedades)}</td></tr>`).join('')}</tbody></table>`;
    }
  };
})();
