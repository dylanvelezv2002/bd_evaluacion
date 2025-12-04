const WORKER_URL = "https://ueb.dylanvillasagua.workers.dev/";

// Colores del diseño actual
const COLORS = ['#2563eb', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1'];

// PREGUNTAS EXACTAS
const QUESTIONS_LABELS = [
    "1. ¿Cómo califica la respuesta y participación de su comunidad el día de hoy?",
    "2. ¿Cómo evalúa el nivel de compromiso e interés de los líderes elegidos?",
    "3. ¿Qué tan clara y útil fue la capacitación sobre medidas de autoprotección?",
    "4. ¿Considera que el Plan Comunitario elaborado hoy es una herramienta útil?",
    "5. ¿Cómo califica el ambiente de confianza y comunicación durante el taller?",
    "6. ¿Cómo evalúa el apoyo brindado por el equipo (UEB, GAD, SNGR)?",
    "7. ¿Considera que hubo inclusión de diversos grupos (mujeres, jóvenes)?",
    "8. ¿Cree que este trabajo servirá de ejemplo para que otras comunidades se organicen?"
];

// INDICES DE COLUMNAS
const C_CAP = { PARROQUIA: 1, NOMBRE: 2, LAT: 4, LNG: 5, SALUD: 6, BOMBEROS: 8, SAT: 11, VEHICULO: 13 };
const C_EVAL = { PARROQUIA: 1, NOMBRE: 2, ROL: 4, LAT: 5, LNG: 6, NOTA_INICIO: 7 }; 

// INDICES OBJ 3 (Confirmados con tu imagen)
const C_OBJ3 = {
    PARROQUIA: 1, 
    COMUNIDAD: 3,     // Col D
    CCGR_RESP: 7,     // Col H
    CCGR_COORD: 8,    // Col I
    L_AUX: 9,         // Col J
    L_INC: 10,        // Col K
    L_EVA: 11,        // Col L
    L_PRO: 12,        // Col M
    LINK_START: 17    // Col R
};

const ANNEX_CONFIG = [
    { idx: 0, title: "Anexo 1: Priorización" },
    { idx: 1, title: "Anexo 2: Acta Reunión" },
    { idx: 2, title: "Anexo 3: Asistencia" },
    { idx: 3, title: "Anexo 4: Comité" },
    { idx: 4, title: "Anexo 5: Hoja Ruta" },
    { idx: 5, title: "Anexo 6: Ficha Integrantes" },
    { idx: 6, title: "Anexo 7: Grupos Promotores" },
    { idx: 7, title: "Anexo 8: Capacitación" },
    { idx: 8, title: "Anexo 9: Eval. Daños" },
    { idx: 9, title: "Anexo 10: Plan Comunitario" },
    { idx: 10, title: "Anexo 11: Ficha Simulacro" },
    { idx: 11, title: "Anexo 12: Inf. Simulacro" },
    { idx: 12, title: "Anexo 13: Acta Red" }
];

const PARROQUIAS = ["Alluriquín", "Puerto Limón", "Luz de América", "San Jacinto del Búa", "Valle Hermoso", "El Esfuerzo", "Santa María del Toachi", "La Villegas", "Monterrey", "Plan Piloto"];

let DC=[], DE=[], D3=[], maps={}, charts={}, layerGroups={};
let PAG = { obj1:{p:1,l:10,d:[]}, obj2:{p:1,l:10,d:[]} };

document.addEventListener('DOMContentLoaded', () => {
    Chart.register(ChartDataLabels);
    setTimeout(()=>document.getElementById('loader')?.classList.add('d-none'), 1500);
    const s = document.getElementById('filter');
    if(s) PARROQUIAS.sort().forEach(p => s.add(new Option(p,p)));
    initMaps();
    loadData();
});

async function loadData() {
    try {
        const r = await fetch(WORKER_URL);
        const j = await r.json();
        DC = j.dataCap||[];
        DE = j.dataEval||[];
        
        D3 = []; 
        for(let k in j) {
            if(Array.isArray(j[k]) && j[k].length > 0 && k !== 'dataCap' && k !== 'dataEval') {
                D3 = j[k];
                break;
            }
        }
        
        applyFilter();
    } catch(e) { console.error("Error cargando datos:", e); }
}

function nav(id, el) {
    document.querySelectorAll('.tab-pane').forEach(t=>{ t.classList.remove('show','active'); t.classList.add('d-none'); });
    const v = document.getElementById('view-'+id);
    if(v){ v.classList.remove('d-none'); setTimeout(()=>v.classList.add('show','active'), 50); }
    document.querySelectorAll('.nav-link').forEach(n=>n.classList.remove('active'));
    if(el) el.classList.add('active');
    
    const navCollapse = document.getElementById('mainNav');
    if(navCollapse.classList.contains('show')){ new bootstrap.Collapse(navCollapse, {toggle:true}); }
    
    // CORRECCIÓN MAPA: Forzar ajuste de tamaño y centrado al cambiar pestaña
    setTimeout(() => {
        Object.keys(maps).forEach(k => {
            maps[k].invalidateSize();
            if (layerGroups[k] && layerGroups[k].getLayers().length > 0) {
                maps[k].fitBounds(layerGroups[k].getBounds(), { padding: [20, 20] });
            }
        });
    }, 300);
}

function applyFilter() {
    const v = document.getElementById('filter').value;
    const isAll = v==='ALL';
    const name = isAll ? "Provincia Sto. Domingo" : v;
    
    const fC = isAll ? DC : DC.filter(r=>r[C_CAP.PARROQUIA]===v);
    const fE = isAll ? DE : DE.filter(r=>r[C_EVAL.PARROQUIA]===v);
    const f3 = isAll ? D3 : D3.filter(r=>r.some(c=>c===v));

    PAG.obj1.d=fC; PAG.obj1.p=1;
    PAG.obj2.d=fE; PAG.obj2.p=1;

    updDiag(fC); 
    updEval(fE); 
    updStrat(f3, name); 
    updRep(fC, fE, f3, name);
}

// === VISTA 1 ===
function updDiag(d) {
    document.getElementById('d_tot').innerText = d.length;
    let s=0, f=0, a=0, v=0, m=[];
    d.forEach(r=>{
        const la=getJ(r[C_CAP.LAT]), ln=getJ(r[C_CAP.LNG]);
        if(la&&ln) m.push(L.circleMarker([la,ln],{radius:6,color:'white',fillColor:'#2563eb',fillOpacity:0.9,weight:2}));
        if(r[C_CAP.SALUD]==='SI')s++; if(r[C_CAP.BOMBEROS]==='SI')f++;
        if(r[C_CAP.SAT]==='SI')a++; if(r[C_CAP.VEHICULO]==='SI')v++;
    });
    updMap('mapDiag',m);
    
    const t=d.length||1;
    document.getElementById('d_sat').innerText=Math.round((a/t)*100)+'%';
    document.getElementById('d_veh').innerText=Math.round((v/t)*100)+'%';
    renderTable('obj1');
    renderPie('chD1',['Salud','Bomberos','Otros'],[s,f,d.length-(s+f)]);
    renderPie('chD2',['SAT','Sin SAT','Vehículo'],[a,d.length-a,v]);
}

// === VISTA 2 (GRÁFICAS GOOGLE FORMS) ===
function updEval(d) {
    const container = document.getElementById('charts_container');
    container.innerHTML = ''; 
    
    let sumTotal = 0, countTotal = 0, m=[];

    QUESTIONS_LABELS.forEach((qTitle, qIndex) => {
        let counts = [0, 0, 0, 0, 0]; 
        let qSum = 0, qCount = 0;

        d.forEach(r => {
            const val = parseInt(safe(r[C_EVAL.NOTA_INICIO + qIndex]));
            if (val >= 1 && val <= 5) {
                counts[val - 1]++;
                qSum += val;
                qCount++;
                sumTotal += val;
                countTotal++;
            }
        });

        const qAvg = qCount ? (qSum/qCount).toFixed(1) : 0;
        const chartId = `chQ_${qIndex}`;

        const col = document.createElement('div');
        col.className = 'col-lg-6';
        col.innerHTML = `
            <div class="card shadow-sm h-100 border-0">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <h6 class="fw-bold text-dark small w-75" style="min-height:40px;">${qTitle}</h6>
                        <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill">Prom: ${qAvg}</span>
                    </div>
                    <div style="height: 200px;">
                        <canvas id="${chartId}"></canvas>
                    </div>
                    <div class="d-flex justify-content-end mt-2">
                        <button class="btn btn-xs btn-outline-secondary small" style="font-size: 0.7rem;" onclick="downloadChartWithTitle('${chartId}', ${qIndex})">
                            <i class="bi bi-download me-1"></i>Descargar
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(col);

        const ctx = document.getElementById(chartId).getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                // CORRECCIÓN: Etiquetas sin paréntesis
                labels: ['1', '2', '3', '4', '5'],
                datasets: [{
                    label: 'Votos',
                    data: counts,
                    backgroundColor: ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'],
                    borderRadius: 4,
                    barPercentage: 0.6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        color: '#333',
                        anchor: 'end',
                        align: 'end',
                        formatter: (v) => v > 0 ? v : ''
                    }
                },
                scales: {
                    x: { display: false, grid: { display: false } },
                    y: { grid: { display: false } }
                }
            }
        });
    });

    d.forEach(r=>{
        const la=getJ(r[C_EVAL.LAT]), ln=getJ(r[C_EVAL.LNG]);
        if(la&&ln) m.push(L.circleMarker([la,ln],{radius:6,color:'white',fillColor:'#ef4444',fillOpacity:0.9,weight:2}));
    });
    updMap('mapEval',m);
    renderTable('obj2');

    const globalAvg = countTotal ? (sumTotal/countTotal).toFixed(2) : "0.0";
    document.getElementById('e_idx').innerText = globalAvg;
    document.getElementById('e_st').innerText = globalAvg >= 4 ? "Excelente" : (globalAvg >= 3 ? "Aceptable" : "Bajo");
}

// === VISTA 3 (DOCUMENTAL) ===
function updStrat(d, n) {
    const l=document.getElementById('strat_list_container');
    l.innerHTML=''; 
    document.getElementById('strat_count').innerText=d.length;
    document.getElementById('strat_empty').classList.remove('d-none');
    document.getElementById('strat_empty').classList.add('show');
    document.getElementById('strat_detail').classList.add('d-none');
    
    if(!d.length) { 
        l.innerHTML='<div class="p-4 text-center text-muted small">No hay comunidades registradas.</div>'; 
        return; 
    }

    d.forEach((r,i)=>{
        const c = r[C_OBJ3.COMUNIDAD] || `Comunidad ${i+1}`;
        let cnt=0; 
        ANNEX_CONFIG.forEach(a=>{
            const colIndex = C_OBJ3.LINK_START + a.idx;
            if(r[colIndex] && r[colIndex].toString().toLowerCase().includes('http')) cnt++;
        });
        const pct = Math.round((cnt/13)*100);
        
        const el = document.createElement('div');
        el.className='comm-list-item d-flex justify-content-between align-items-center';
        el.onclick=function(){
            document.querySelectorAll('.comm-list-item').forEach(x=>x.classList.remove('active'));
            el.classList.add('active');
            showDet(r,c,pct);
        };
        el.innerHTML=`
            <div class="d-flex flex-column" style="overflow:hidden;">
                <span class="small fw-bold text-truncate text-dark">${c}</span>
                <span class="text-muted" style="font-size:0.7rem">Ver expediente</span>
            </div>
            <span class="badge ${pct==100?'bg-success':'bg-secondary'} rounded-pill">${pct}%</span>
        `;
        l.appendChild(el);
    });
}

function showDet(r,c,pct) {
    document.getElementById('strat_empty').classList.add('d-none');
    document.getElementById('strat_empty').classList.remove('show');
    const det = document.getElementById('strat_detail');
    det.classList.remove('d-none');
    setTimeout(()=>det.classList.add('show'),10);

    document.getElementById('sel_comm_name').innerText=c;
    document.getElementById('sel_comm_parr').innerText=r[C_OBJ3.PARROQUIA] || 'N/A';
    document.getElementById('sel_progress').innerText=pct+'%';

    const b = document.getElementById('brigade_info');
    b.innerHTML = `
        <div class="col-6 col-md-6 border-end border-secondary-subtle">
            <div class="text-muted text-uppercase mb-1" style="font-size:0.65rem;">Responsable</div>
            <div class="fw-bold text-dark text-break small">${r[C_OBJ3.CCGR_RESP]||'No asignado'}</div>
        </div>
        <div class="col-6 col-md-6">
            <div class="text-muted text-uppercase mb-1" style="font-size:0.65rem;">Coordinador</div>
            <div class="fw-bold text-dark text-break small">${r[C_OBJ3.CCGR_COORD]||'No asignado'}</div>
        </div>
        <div class="col-12"><hr class="my-2 border-secondary-subtle"></div>
        <div class="col-6 col-md-3">
            <div class="text-muted" style="font-size:0.7rem">Auxilios</div>
            <div class="fw-bold small text-primary text-break">${r[C_OBJ3.L_AUX]||'-'}</div>
        </div>
        <div class="col-6 col-md-3">
            <div class="text-muted" style="font-size:0.7rem">Incendios</div>
            <div class="fw-bold small text-danger text-break">${r[C_OBJ3.L_INC]||'-'}</div>
        </div>
        <div class="col-6 col-md-3">
            <div class="text-muted" style="font-size:0.7rem">Evacuación</div>
            <div class="fw-bold small text-warning text-break">${r[C_OBJ3.L_EVA]||'-'}</div>
        </div>
        <div class="col-6 col-md-3">
            <div class="text-muted" style="font-size:0.7rem">Promoción</div>
            <div class="fw-bold small text-info text-break">${r[C_OBJ3.L_PRO]||'-'}</div>
        </div>
    `;

    const g = document.getElementById('strat_grid'); g.innerHTML='';
    ANNEX_CONFIG.forEach(a=>{
        const colIndex = C_OBJ3.LINK_START + a.idx;
        const url = r[colIndex];
        const has = url && url.toString().toLowerCase().includes('http');
        
        g.innerHTML += `
            <div class="col-6 col-md-4 col-xl-3">
                <div class="file-card p-3 h-100 ${has?'ok':'pending'} d-flex flex-column justify-content-between">
                    <div>
                        <div class="d-flex justify-content-between mb-2">
                            <i class="bi ${has?'bi-file-earmark-pdf-fill text-success':'bi-file-earmark-x text-muted'} fs-5"></i>
                            ${has?'<i class="bi bi-check-circle-fill text-success"></i>':''}
                        </div>
                        <div class="small fw-bold mb-2 text-dark" style="font-size:0.75rem;">${a.title}</div>
                    </div>
                    ${has ? `<a href="${url}" target="_blank" class="btn btn-sm btn-outline-success w-100 py-1 mt-2" style="font-size:0.7rem;">ABRIR</a>` : '<span class="d-block text-center text-muted small py-1 mt-2 border rounded bg-light" style="font-size:0.7rem">PENDIENTE</span>'}
                </div>
            </div>`;
    });
}

function updRep(dc, de, d3, n){
    document.getElementById('r_loc').innerText=n; 
    const date = new Date();
    document.getElementById('r_date').innerText=`${date.getDate()} de ${date.toLocaleString('es-ES', { month: 'long' })} del ${date.getFullYear()}`;
    
    const sat = dc.filter(x=>x[C_CAP.SAT]=='SI').length;
    const veh = dc.filter(x=>x[C_CAP.VEHICULO]=='SI').length;
    
    document.getElementById('r_txt_cap').innerHTML = `
        <p>En el análisis territorial realizado en <strong>${n}</strong>, se han identificado un total de <strong>${dc.length} infraestructuras clave</strong>. 
        De estas, el <strong>${Math.round((sat/(dc.length||1))*100)}%</strong> cuenta con Sistemas de Alerta Temprana (SAT) activos.</p>
        <p>Se dispone de <strong>${veh} vehículos</strong> operativos. La cobertura de salud alcanza al <strong>${Math.round((dc.filter(x=>x[C_CAP.SALUD]=='SI').length/(dc.length||1))*100)}%</strong> de los puntos evaluados.</p>
    `;

    let sumT = 0, countT = 0;
    de.forEach(r => { 
        for(let i=0;i<8;i++) {
            const v = safe(r[C_EVAL.NOTA_INICIO+i]);
            if(v){ sumT+=v; countT++; }
        }
    });
    const promGlobal = countT ? (sumT / countT).toFixed(2) : 0;
    
    document.getElementById('r_txt_soc').innerHTML = `
        <p>Se han realizado encuestas a <strong>${de.length} actores locales</strong>, obteniendo un índice de resiliencia promedio de <strong>${promGlobal} sobre 5.0</strong>. 
        Este valor indica un nivel de compromiso <strong>${promGlobal>3.5?'Alto':(promGlobal>2.5?'Medio':'Bajo')}</strong>.</p>
        <p>Se está trabajando con <strong>${d3.length} comunidades</strong> en el proceso de conformación de comités de gestión de riesgos.</p>
    `;

    renderPie('chR1',['Salud','Bomberos','SAT'],[dc.filter(x=>x[C_CAP.SALUD]=='SI').length, dc.filter(x=>x[C_CAP.BOMBEROS]=='SI').length, sat]);
}

// === UTILIDADES ===

// FUNCION NUEVA: Descargar gráfica CON título
function downloadChartWithTitle(chartId, qIndex) {
    const originalCanvas = document.getElementById(chartId);
    const questionText = QUESTIONS_LABELS[qIndex];
    
    // Crear canvas temporal
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    
    // Configurar dimensiones
    const padding = 20;
    const headerHeight = 80; // Espacio para la pregunta
    tempCanvas.width = originalCanvas.width + (padding * 2);
    tempCanvas.height = originalCanvas.height + headerHeight + padding;
    
    // 1. Fondo Blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // 2. Escribir Pregunta
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    
    // Función simple para ajustar texto
    wrapText(ctx, questionText, tempCanvas.width / 2, 40, tempCanvas.width - 60, 20);
    
    // 3. Dibujar la Gráfica Original
    ctx.drawImage(originalCanvas, padding, headerHeight);
    
    // 4. Descargar
    const link = document.createElement('a');
    link.download = `Pregunta_${qIndex + 1}_Resultado.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    for(let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, y);
}

function renderPie(id,l,d){
    const c=document.getElementById(id); if(!c)return; if(charts[id])charts[id].destroy();
    charts[id]=new Chart(c,{type:'pie',data:{labels:l,datasets:[{data:d,backgroundColor:COLORS}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{boxWidth:12,font:{size:10, family:'Poppins'}}},datalabels:{color:'white',font:{weight:'bold'},formatter:(v,ctx)=>{let sum=ctx.chart.data.datasets[0].data.reduce((a,b)=>a+b,0); return sum>0?Math.round((v*100)/sum)+'%':''}}}}});
}

function renderTable(t){
    const c=PAG[t], s=(c.p-1)*c.l, dt=c.d.slice(s,s+c.l), tb=document.querySelector(`#table_${t} tbody`);
    if(tb){
        tb.innerHTML='';
        dt.forEach((r,i)=>{
            const id=s+i+1;
            if(t=='obj1') tb.innerHTML+=`<tr><td>${id}</td><td class="fw-bold">${r[C_CAP.NOMBRE]}</td><td>${r[C_CAP.PARROQUIA]}</td><td><small class="font-monospace">${(r[C_CAP.LAT]||'').toString().substr(0,6)}</small></td><td>${r[C_CAP.SALUD]=='SI'?'<span class="text-success fw-bold">SI</span>':'-'}</td><td>${r[C_CAP.BOMBEROS]=='SI'?'<span class="text-success fw-bold">SI</span>':'-'}</td><td>${r[C_CAP.SAT]=='SI'?'<span class="text-primary fw-bold">SI</span>':'-'}</td><td>${r[C_CAP.VEHICULO]=='SI'?'<span class="text-primary fw-bold">SI</span>':'-'}</td></tr>`;
            else { 
                let a=0, cn=0; 
                for(let k=0;k<8;k++){ const v=safe(r[C_EVAL.NOTA_INICIO+k]); if(v){a+=v; cn++;} }
                const prom = cn ? (a/cn).toFixed(2) : '0.00';
                tb.innerHTML+=`<tr><td>${id}</td><td class="fw-bold">${r[C_EVAL.NOMBRE]}</td><td>${r[C_EVAL.PARROQUIA]}</td><td><small class="text-muted">${r[C_EVAL.ROL]}</small></td><td><span class="badge ${prom>=3?'bg-success':'bg-warning text-dark'}">${prom}</span></td></tr>`; 
            }
        });
        document.getElementById(`info_${t}`).innerText=`${s+1} - ${Math.min(s+c.l,c.d.length)} de ${c.d.length}`;
    }
}

function prevPage(t){if(PAG[t].p>1){PAG[t].p--;renderTable(t)}}
function nextPage(t){if(PAG[t].p*PAG[t].l<PAG[t].d.length){PAG[t].p++;renderTable(t)}}
function initMaps(){ ['mapDiag','mapEval'].forEach(i=>{ const e=document.getElementById(i); if(e){ maps[i]=L.map(i,{zoomControl:false}).setView([-0.25,-79.17],9); L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(maps[i]); layerGroups[i]=L.featureGroup().addTo(maps[i]); } }); }
function updMap(i,m){if(maps[i]){layerGroups[i].clearLayers();m.forEach(x=>x.addTo(layerGroups[i]));if(m.length)maps[i].fitBounds(layerGroups[i].getBounds(),{padding:[20,20]})}}
function getJ(v){let n=safe(v);return n?n+(Math.random()-0.5)*0.003:null}
function safe(v){return v?parseFloat(v.toString().replace(',','.')):null}
function printReport(i){ const el = document.getElementById(i); el.style.width = '100%'; html2pdf().set({ margin: [0.5, 0.5], filename: 'Informe_Practicum.pdf', image: {type:'jpeg',quality:0.98}, html2canvas: {scale:2, useCORS:true}, jsPDF: {unit:'in',format:'letter', orientation:'portrait'} }).from(el).save(); }
window.filterStratList=()=>{const t=document.getElementById('searchStrat').value.toLowerCase();document.querySelectorAll('.comm-list-item').forEach(i=>i.style.display=i.innerText.toLowerCase().includes(t)?'flex':'none')}
window.nav=nav;window.applyFilter=applyFilter;window.loadData=loadData;window.printReport=printReport;window.prevPage=prevPage;window.nextPage=nextPage; window.downloadChartWithTitle=downloadChartWithTitle;
