// ==UserScript==
// @name         GRV Tools com Endereço e Policial 3 em 1 v1.4.4 (SRC)
// @namespace    vitor.grv.tools
// @version      1.4.4
// @description  LISTA (canônica) + ENDEREÇO (Apreensão/Remoção/Ambos – opcional) + POLICIAL (opcional, via DETALHE). Situação por status, datas sem .000000. Exporta XLSX/TSV. UI aprovada (padrão: filtro "No pátio"; páginas 1→5; sem atalhos). Força 100 por página, aplica filtro de Situação JÁ NA API e coleta exatamente N×100 mantidos.
// @match        https://intranet.consorciorioparkingcarioca.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

/* =============================================================================
   GRV Tools — 3 em 1 (Lista + Endereço + Policial)

   ► CHANGELOG (resumo relevante)
     v1.4.4 (este arquivo)
       • Persistência do estado minimizado em localStorage
         - Se você fechar/recarregar a página, a HUD volta minimizada/expandida
           conforme estava (chave: grvtools_ui_collapsed).
       • Organização em seções + comentários didáticos.
       • Fluxo principal inalterado (captura/lista/detalhe/exportações/UI).

     v1.4.3
       • Botão Minimizar/Restaurar no cabeçalho (e por duplo-clique no header).
       • Redimensionamento pelas bordas (E/D/Cima/Baixo) com limites.
       • Restante do fluxo inalterado.

     v1.4.0
       • Filtro por Situação aplicado NO SERVIDOR (API).
       • Meta de mantidos (Fim=N ⇒ junta N×100 mantidos).
       • Força 100 por página (limit/perPage/pageSize/size = 100).

     v1.3.0
       • (obsoleto) meta de mantidos coexistia com limite de “páginas cruas”.

     v1.2.0
       • TSV estável (sanitização \n, \t, NBSP).

   ⚖️ Situação — regra canônica (SEM TEXTO da UI!)
   • Fonte da verdade: status numérico da LISTA.
   • Mapa:
        0: "Pendente"
        1: "No pátio"
        2: "Em leilão"
        4: "Clone"
        5: "Excluir"
        6: "Frustrado"
        100: "Retirado pelo proprietário"
        101: "Retirado por leilão"
        102: "Retirado por decisão judicial"
        104: "Retirado pelo representante legal"
        105: "Retirado por prensa"
        107: "Retirado por leilão externo"
        108: "Retirado por roubo/furto"
        109: "Retirado por leilão pelo representante legal"
        110: "Retirado pelo representante legal - Óbito"

   🕒 Datas — remover “.000000” e formatar dd/MM/yyyy HH:mm
   🧭 Policial — DETALHE por id (nunca por numero)
   🧩 Endereço — LISTA only (sem detalhe)
   📋 TSV — sanitização para colagem perfeita
============================================================================= */

(function () {
  "use strict";

  /* =============================== CHAVES LS =============================== */
  // Persistência de preferências/estado visual da HUD
  const LS_BEARER_KEY   = "grvtools_last_bearer";
  const LS_COLLAPSE_KEY = "grvtools_ui_collapsed"; // "1" = minimizada; "0" = expandida

  /* =============================== ESTADO =============================== */
  const STATE = {
    authHeader: localStorage.getItem(LS_BEARER_KEY) || "",
    listBase: "",
    baseLoggedOnce: false,
    rowsAOA: null,

    // UI/HUD
    minimized: localStorage.getItem(LS_COLLAPSE_KEY) === "1", // ← persiste entre sessões
    lastSize: { w: 610, h: 520 }, // tamanho que restauramos ao expandir
  };

  /* =============================== MAPAS =============================== */
  const SITUACAO_MAP = {
    0:"Pendente",1:"No pátio",2:"Em leilão",4:"Clone",5:"Excluir",6:"Frustrado",
    100:"Retirado pelo proprietário",101:"Retirado por leilão",
    102:"Retirado por decisão judicial",104:"Retirado pelo representante legal",
    105:"Retirado por prensa",107:"Retirado por leilão externo",
    108:"Retirado por roubo/furto",109:"Retirado por leilão pelo representante legal",
    110:"Retirado pelo representante legal - Óbito",
  };
  const RET_STATUS = new Set([100,101,102,104,105,107,108,109,110]);

  // Opções do filtro (valor interno → label exibida)
  const FILTER_OPTIONS = [
    ["all","Todos"],["1","No pátio"],["0","Pendente"],["2","Em leilão"],
    ["4","Clone"],["5","Excluir"],["6","Frustrado"],["ret","Retirados (qualquer)"],
    ["100","Retirado pelo proprietário"],["101","Retirado por leilão"],
    ["102","Retirado por decisão judicial"],["104","Retirado pelo representante legal"],
    ["105","Retirado por prensa"],["107","Retirado por leilão externo"],
    ["108","Retirado por roubo/furto"],["109","Retirado por leilão pelo representante legal"],
    ["110","Retirado pelo representante legal - Óbito"],
  ];

  /* =============================== UTILS =============================== */
  const p2 = (n) => String(n).padStart(2, "0");
  const ts = () => { const d=new Date(); return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}_${p2(d.getHours())}h.${p2(d.getMinutes())}min.${p2(d.getSeconds())}seg`; };
  const sleep = (ms) => new Promise(r=>setTimeout(r,ms));
  const safe  = (v) => (v==null || v==="") ? "-----" : String(v);
  const mask  = (s,max=54)=> !s ? "—" : (s.length>max ? (s.slice(0,Math.floor(max/2)-1)+"…"+s.slice(-Math.floor(max/2))) : s);
  const log   = (m)=>{ try{ if(logEl){ logEl.value += m + "\n"; logEl.scrollTop = logEl.scrollHeight; } }catch{} };

  function updateBadges(){
    try{
      badgeTok.textContent  = "Token: " + mask(STATE.authHeader, 44);
      badgeTok.title        = STATE.authHeader || "—";
      badgeBase.textContent = "Base: " + mask(STATE.listBase, 60);
      badgeBase.title       = STATE.listBase || "—";
    }catch{}
  }

  /* ========================== DETECÇÃO DA LISTA ========================== */
  function isList(u){
    try{ const url=new URL(u,location.origin); return /^\/api\/grv\/?$/.test(url.pathname); }catch{ return false; }
  }
  function normalizeBase(u){
    try{
      const url=new URL(u, location.origin);
      ["page","pagina","_","t","ts","nocache","cacheBust","limit","perPage","pageSize","size","status"].forEach(k=>url.searchParams.delete(k));
      url.hash="";
      return url.origin + url.pathname + (url.search?("?"+url.searchParams.toString()):"");
    }catch{ return String(u||""); }
  }
  function latchListBase(u){
    if (!u || !isList(u)) return;
    STATE.listBase = normalizeBase(u);
    updateBadges();
    if (!STATE.baseLoggedOnce){
      STATE.baseLoggedOnce = true;
      log("✓ Base da LISTA detectada.");
    }
  }

  /* ============================== BEARER TOKEN ============================== */
  function setBearer(v){
    if (!v) return;
    const s=String(v).trim();
    if (!s || s===STATE.authHeader) return;
    STATE.authHeader=s;
    try{ localStorage.setItem(LS_BEARER_KEY, s); }catch{}
    updateBadges();
  }

  // Intercepta fetch/XHR para capturar Authorization e a URL base da LISTA
  const _fetch = window.fetch;
  window.fetch = function(input, init){
    try{
      const h = init && init.headers;
      if (h){
        if (typeof h.get==="function"){
          const v = h.get("Authorization") || h.get("authorization"); if (v) setBearer(v);
        } else if (Array.isArray(h)){
          for(const [k,v] of h) if (String(k).toLowerCase()==="authorization") setBearer(v);
        } else if (typeof h === "object"){
          for(const k in h) if (k.toLowerCase()==="authorization") setBearer(h[k]);
        }
      }
    }catch{}
    const url = (typeof input==="string") ? input : (input && input.url);
    return _fetch.apply(this, arguments).then(res=>{
      try{
        const u = (res && res.url) ? res.url : (url || "");
        if (res && res.ok && isList(u)) latchListBase(u);
      }catch{}
      return res;
    });
  };
  const XHR = window.XMLHttpRequest;
  const _open = XHR.prototype.open;
  const _set  = XHR.prototype.setRequestHeader;
  const _send = XHR.prototype.send;
  XHR.prototype.open = function(m,u){ this.__url=u; return _open.apply(this,arguments); };
  XHR.prototype.setRequestHeader = function(k,v){ try{ if(String(k).toLowerCase()==="authorization") setBearer(v);}catch{} return _set.apply(this,arguments); };
  XHR.prototype.send = function(){
    try{
      this.addEventListener("load", ()=>{ try{ if (this.status>=200 && this.status<400 && isList(this.__url)) latchListBase(this.__url); }catch{} });
    }catch{}
    return _send.apply(this,arguments);
  };
  function tryPerf(){
    try{
      const es=performance.getEntriesByType("resource");
      for(let i=es.length-1;i>=0;i--){ const u=es[i].name||""; if(isList(u)){ latchListBase(u); break; } }
    }catch{}
  }

  /* =============================== REDE/LISTA =============================== */

  // Aplica o filtro de Situação JÁ NA API adicionando status= na query.
  function applyServerFilterToUrl(u, filterValue){
    const url = new URL(u, location.origin);
    url.searchParams.delete("status");

    if (filterValue === "all") return url.toString();
    if (filterValue === "ret") { for (const s of RET_STATUS) url.searchParams.append("status", String(s)); return url.toString(); }
    const want = Number(filterValue);
    if (Number.isFinite(want)) url.searchParams.append("status", String(want));
    return url.toString();
  }

  async function jget(u){
    const r = await fetch(u, { headers: { "Authorization": STATE.authHeader }});
    const t = await r.text();
    try{ return JSON.parse(t); }catch{ throw new Error("Resposta não-JSON"); }
  }

  // Força 100 por página
  function pageUrl(base, n){
    const u = new URL(base, location.origin);
    if (u.searchParams.has("page")) u.searchParams.set("page", n);
    else if (u.searchParams.has("pagina")) u.searchParams.set("pagina", n);
    else u.searchParams.set("page", n);
    u.searchParams.set("limit","100"); u.searchParams.set("perPage","100");
    u.searchParams.set("pageSize","100"); u.searchParams.set("size","100");
    return u.toString();
  }

  async function getListPage(base, n, filterValue){
    let u = pageUrl(base, n);
    u = applyServerFilterToUrl(u, filterValue);
    const d = await jget(u);
    if (Array.isArray(d)) return d;
    for (const k of ["arrayData","items","data","rows","records"]) if (Array.isArray(d?.[k])) return d[k];
    return [];
  }

  /* =========================== SITUAÇÃO CANÔNICA =========================== */
  function situacaoFromStatus(code){
    if (RET_STATUS.has(code)) return SITUACAO_MAP[code];
    if (Object.prototype.hasOwnProperty.call(SITUACAO_MAP, code)) return SITUACAO_MAP[code];
    return Number.isFinite(code) ? `Status ${code}` : "-----";
  }

  /* ========================== FILTRO DE SITUAÇÃO (fallback) ================= */
  function passFilter(code, filterValue){
    if (filterValue === "all") return true;
    if (filterValue === "ret") return RET_STATUS.has(code);
    const want = Number(filterValue);
    return Number.isFinite(want) && code === want;
  }

  /* ============================ DATAS (LIMPEZA) ============================ */
  function parseDateCandidate(v){
    if (v == null) return null;
    let x = v;
    if (typeof x === "object") x = x.date || x.data || x.dataHora || x.value || x;
    if (typeof x !== "string") x = String(x);
    let t = x.trim();
    const m = t.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d{3,6})?$/);
    if (m) t = `${m[1]}T${m[2]}`;
    const d = new Date(t);
    if (!isNaN(d.getTime())) return d;
    return t.replace(/\.\d{3,6}$/, "");
  }
  function fmtBr(val){
    const d = parseDateCandidate(val);
    if (d == null) return "-----";
    if (d instanceof Date) return `${p2(d.getDate())}/${p2(d.getMonth()+1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
    return d;
  }

  /* ======================= ENDEREÇO (LISTA-ONLY; OPCIONAL) ================== */
  function pickEnderecoFromList(item, origin){
    if (origin === "apreensao"){
      return [ safe(item?.enderecoApreensao), safe(item?.bairroApreensao), safe(item?.cidadeApreensao), safe(item?.ufApreensao), safe(item?.complementoApreensao) ];
    } else { // remocao
      return [ safe(item?.enderecoRemocao), safe(item?.bairroRemocao), safe(item?.cidadeRemocao), safe(item?.ufRemocao), safe(item?.complementoRemocao) ];
    }
  }

  /* ============================== POLICIAL (DETALHE) ============================== */
  function getPolicialOficialFromDetalhe(det){
    const p = det?.policialApreensao || det?.policial || det?.agenteApreensor || null;
    const nome = safe(p?.nome);
    const mat  = safe(p?.matricula);
    return {nome, mat};
  }

  function parsePolicialFromObservacao(text){
    if (!text) return {nomeObs:"-----", matObs:"-----"};
    let t = String(text)
      .replace(/\r\n?/g, "\n").replace(/\u00A0/g, " ")
      .replace(/\*+/g, "").replace(/[ \t]+/g, " ").replace(/[ \t]*\n[ \t]*/g, "\n");
    t = t.replace(/(\d)[^\S\n]*\n[^\S\n]*(\d)/g, "$1$2");
    const digits = s => String(s||"").replace(/\D+/g, "");
    const clean  = s => String(s||"").replace(/[ \t]+/g, " ").trim();

    let matObs = "-----";
    const m = t.match(/\b(?:Mat\.?\s*\/?\s*RG|Matr(?:\.|[íi]cula)?|Matric(?:ula)?|Mat\.?|RG(?:\/ID)?)\b\s*[:\-]?\s*([^\n]+)/i);
    if (m){
      const d = digits(m[1]);
      if (d.length>=5 && d.length<=12) matObs = d;
      else { const md = m[1].match(/\b(\d{5,12})\b/); if (md) matObs = md[1]; }
    } else {
      const line = t.split("\n").find(l => /\bMat/i.test(l) || /\bRG\b/i.test(l));
      if (line){
        const drop = line.replace(/Cel\.?:.*$/i, "");
        const d = digits(drop); const md = d.match(/(\d{5,12})/);
        if (md) matObs = md[1];
      }
    }

    let nomeObs = "-----";
    let n = t.match(/\bNome\s*(?:e\s*Cargo\/?Patente|\/?Cargo\/?Patente)?\s*:\s*([^\n]+)/i);
    if (n){
      let seg = n[1];
      seg = seg.split(/\b(Mat\.?\/?RG|Mat\.?|Matr(?:\.|[íi]cula)?|RG(?:\/ID)?|Unidade|N[ºo]\s*da\s*VTR|Cel\.?)\b/i)[0];
      nomeObs = clean(seg);
    } else if ((n = t.match(/\bNome\s*:\s*([^\n]+)/i))){
      let seg = n[1];
      seg = seg.split(/\b(Cargo|Cargo\/?Patente|Mat\.?\/?RG|Mat\.?|Matr(?:\.|[íi]cula)?|RG(?:\/ID)?)\b/i)[0];
      nomeObs = clean(seg);
    } else if ((n = t.match(/\b(Policial|Apreensor|Agente|Inspetor|Oficial)\s*:\s*([^\n]+)/i))) {
      nomeObs = clean(n[2]);
    } else {
      let after = t;
      const h = t.match(/DADOS DO SOLICITANTE/i);
      if (h) after = t.slice(h.index + h[0].length);
      const line = after.split("\n").map(s=>s.trim())
        .find(s => s && !/^\d{5,}$/.test(digits(s)) && !/(Unidade|VTR|Cel|Foi acionado|Nome do terceiro|RG\/ID)/i.test(s));
      if (line) nomeObs = line;
    }
    if (nomeObs.includes("/")){
      const [left,right] = nomeObs.split("/").map(s=>s.trim());
      if (right && /^(cabo|cbpm|sgt|soldado|sd|ten|tenente|cap|capit|insp|agente|investigador|oficial)\b/i.test(right)) {
        nomeObs = left;
      }
    }
    return {nomeObs, matObs};
  }

  async function fetchDetalheByIdOrNumero(listItem){
    const apiOrigin = (STATE.listBase ? new URL(STATE.listBase).origin : location.origin);
    const headers = { "Authorization": STATE.authHeader, "Accept": "application/json" };

    async function jget2(url){
      const r = await fetch(url, { headers });
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      const txt = await r.text();
      if (!ct.includes("json")) throw new Error(`não-JSON (${r.status})`);
      try { return JSON.parse(txt); }
      catch(e){ throw new Error(`json inválido (${r.status})`); }
    }

    const id = listItem?.id || listItem?.grvId || null;
    if (id != null){
      return await jget2(`${apiOrigin}/api/grv/${id}?dadosExtras=true`);
    }

    const numero = listItem?.numero;
    if (!numero) throw new Error("sem id e sem numero");
    const qs = new URLSearchParams({ numero: String(numero) }).toString();

    const search = await jget2(`${apiOrigin}/api/grv?${qs}`);
    let found = null;
    if (Array.isArray(search)){
      found = search[0];
    } else if (search && typeof search === "object"){
      for (const k of ["arrayData","items","data","rows","records"]) {
        if (Array.isArray(search[k])) { found = search[k][0]; break; }
      }
      if (!found && search.id) found = search;
    }
    const rid = found?.id || found?.grvId;
    if (rid == null) throw new Error("não foi possível resolver id pelo numero");
    return await jget2(`${apiOrigin}/api/grv/${rid}?dadosExtras=true`);
  }

  /* =========================== MAPEAMENTO DE LINHA ========================== */
  function baseRow(item){
    const code = Number(item?.status);
    const situ = situacaoFromStatus(code);
    const isRet = RET_STATUS.has(code);
    return [
      safe(item?.numero),
      safe(item?.placaOriginal),
      safe(item?.placa || "----"),
      safe(item?.chassi),
      fmtBr(item?.dataApreensao?.date || item?.dataApreensao || item?.apreensaoData),
      isRet ? fmtBr(
        item?.retirada?.dataRetirada?.date ||
        item?.dataRetirada?.date || item?.dataRetirada ||
        item?.dataSaidaPatio?.date || item?.dataSaidaPatio ||
        item?.baixa?.date || item?.liberacao?.date
      ) : "-----",
      safe(item?.marca || item?.marcaModelo || item?.modelo),
      safe(item?.patio?.nome || item?.patioNome),
      safe(item?.vaga),
      safe(item?.numeroChave),
      situ
    ];
  }

  /* ================================ UI (PAINEL) ================================ */
  let panel, logEl, badgeTok, badgeBase, inStart, inEnd, selFilter, btnRun, btnXLSX, btnCopy, btnCopyLog;
  let chkAddr, addrBox, radAp, radRm, radBoth;
  let chkPol, polBox, chkPolOficial, chkPolObs;
  let btnMin, bodyWrap;
  let resL, resR, resT, resB;

  function buildPanel(){
    panel=document.createElement("div");
    panel.id = "grv_panel";        // ← AQUI (nova linha)
    panel.style.cssText=[
      "position:fixed","right:20px","bottom:20px","z-index:2147483647",
      "background:#0d1117","color:#e6edf3","border:1px solid #30363d",
      "border-radius:10px","width:610px","box-shadow:0 8px 20px rgba(0,0,0,.55)",
      "font-family:Segoe UI,Arial,sans-serif","font-size:13px",
      "min-width:320px","min-height:100px"
    ].join(";");

    panel.innerHTML=`
      <div id="grv_head" style="padding:6px 10px;display:flex;gap:8px;align-items:center;border-bottom:1px solid #30363d;cursor:move;background:#010409;">
        <b id="grv_title" style="flex:1;">GRV Tools com Endereço e Policial 3 em 1 v1.4.4</b>
        <span id="grv_badge_tok"  style="font-size:10px;opacity:.9;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Token: —</span>
        <span id="grv_badge_base" style="font-size:10px;opacity:.9;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Base: —</span>
        <button id="grv_min" title="Minimizar / Restaurar"
                style="margin-left:8px;width:26px;height:24px;line-height:20px;border-radius:6px;background:#161b22;color:#e6edf3;border:1px solid #30363d;cursor:pointer">–</button>
      </div>

      <div id="grv_body">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:8px;">
          <div><label style="font-size:11px;opacity:.8">Início (página)</label><input id="grv_start" type="number" min="1" value="1" style="width:100%;background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:6px"></div>
          <div><label style="font-size:11px;opacity:.8">Fim (0 = até zerar)</label><input id="grv_end" type="number" min="0" value="5" style="width:100%;background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:6px"></div>
          <div>
            <label style="font-size:11px;opacity:.8">Filtrar Situação</label>
            <select id="grv_filter" style="width:100%;background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:6px"></select>
            <div style="font-size:10px;opacity:.7;margin-top:4px">Padrão fixo: "No pátio"</div>
          </div>
        </div>

        <div style="padding:0 8px 6px 8px;font-size:11px;opacity:.85">
          O script força <b>100 por página</b> e injeta <code>status=</code> na API conforme o filtro do script.
          Se “Fim”=5, a meta é juntar <b>500 mantidos</b> pelo filtro (ou até a lista zerar).
        </div>

        <div style="padding:8px;border-top:1px solid #30363d">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input id="grv_addr_enable" type="checkbox">
            <span>Incluir endereço</span>
          </label>
          <div id="grv_addr_box" style="display:none;margin-top:6px;padding:8px;background:#0a0f14;border:1px solid #30363d;border-radius:6px">
            <div style="margin-bottom:6px;font-size:12px;opacity:.9">Origem:</div>
            <label style="margin-right:12px"><input type="radio" name="grv_addr_origin" value="apreensao" checked> Apreensão</label>
            <label style="margin-right:12px"><input type="radio" name="grv_addr_origin" value="remocao"> Remoção</label>
            <label><input type="radio" name="grv_addr_origin" value="ambos"> Ambos</label>
            <div style="font-size:10px;opacity:.7;margin-top:6px">LISTA-only; campos ausentes ficam "-----".</div>
          </div>
        </div>

        <div style="padding:8px;border-top:1px solid #30363d">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input id="grv_pol_enable" type="checkbox">
            <span>Incluir policial (usa DETALHE)</span>
          </label>
          <div id="grv_pol_box" style="display:none;margin-top:6px;padding:8px;background:#0a0f14;border:1px solid #30363d;border-radius:6px">
            <label style="margin-right:12px"><input id="grv_pol_oficial" type="checkbox" checked> Oficiais (nome/matrícula)</label>
            <label><input id="grv_pol_obs" type="checkbox"> Observação (nome/matrícula)</label>
            <div style="font-size:10px;opacity:.7;margin-top:6px">DETALHE com 2 workers fixos; falhas preenchem "-----" e são logadas.</div>
          </div>
        </div>

        <div style="display:flex;gap:8px;padding:8px;flex-wrap:wrap;border-top:1px solid #30363d">
          <button id="grv_run"   style="flex:1;padding:8px;border-radius:6px;background:#238636;color:#fff;border:1px solid #2ea043;cursor:pointer">Capturar</button>
          <button id="grv_xlsx"  style="flex:1;padding:8px;border-radius:6px;background:#1f6feb;color:#fff;border:1px solid #388bfd;cursor:pointer" disabled>Baixar XLSX</button>
          <button id="grv_copy"  style="flex:1;padding:8px;border-radius:6px;background:#9e6c00;color:#fff;border:1px solid #b88400;cursor:pointer" disabled>Copiar TSV</button>
          <button id="grv_copy_log" style="flex:1;padding:8px;border-radius:6px;background:#6e7681;color:#0d1117;border:1px solid #8b949e;cursor:pointer">Copiar Log</button>
        </div>

        <textarea id="grv_log" readonly style="width:100%;margin:0 8px 8px;height:240px;background:#0a0f14;color:#d1f7c4;border:1px solid #30363d;border-radius:6px;resize:vertical;font-family:ui-monospace,Consolas,Menlo,monospace;font-size:12px;padding:8px"></textarea>
      </div>
    `;

    document.body.appendChild(panel);

// garante que nada “estoure” horizontalmente
const style = document.createElement("style");
style.textContent = `
  #grv_panel, #grv_panel * { box-sizing: border-box; }
  #grv_panel { overflow: hidden; } /* corta qualquer sobra */
  #grv_panel textarea#grv_log {
    display: block;
    width: 100%;       /* sem calc(...) */
    max-width: 100%;
  }
`;
document.head.appendChild(style);


    // Handles de resize nas 4 bordas
    for (const [id,css] of [
      ["grv_res_l","left:0;top:0;height:100%;width:6px;cursor:ew-resize"],
      ["grv_res_r","right:0;top:0;height:100%;width:6px;cursor:ew-resize"],
      ["grv_res_t","left:0;top:0;width:100%;height:6px;cursor:ns-resize"],
      ["grv_res_b","left:0;bottom:0;width:100%;height:6px;cursor:ns-resize"],
    ]){
      const h=document.createElement("div");
      h.id=id; h.style.cssText=`position:absolute;${css};user-select:none`;
      panel.appendChild(h);
    }

    // Arrastar painel (cabeçalho)
    const head=panel.querySelector("#grv_head"); let sx=0,sy=0,ox=0,oy=0,drag=false;
    head.addEventListener("mousedown",e=>{ if (e.target.id==="grv_min") return; drag=true;sx=e.clientX;sy=e.clientY;const r=panel.getBoundingClientRect();ox=r.left;oy=r.top; });
      window.addEventListener("mousemove", e=>{
  if(!drag) return;

  const vw = Math.max(document.documentElement.clientWidth,  window.innerWidth  || 0);
  const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
  const r  = panel.getBoundingClientRect();
  const margin = 10;

  let nx = ox + (e.clientX - sx);
  let ny = oy + (e.clientY - sy);

  // mantém 10px visíveis dentro da viewport
  nx = Math.min(Math.max(nx, margin), vw - margin - r.width);
  ny = Math.min(Math.max(ny, margin), vh - margin - r.height);

  panel.style.left = nx + "px";
  panel.style.top  = ny + "px";
  panel.style.right = "auto";
  panel.style.bottom= "auto";
});

    window.addEventListener("mouseup",()=>drag=false);

    // refs
    bodyWrap = panel.querySelector("#grv_body");
    btnMin   = panel.querySelector("#grv_min");

    logEl     = panel.querySelector("#grv_log");
    badgeTok  = panel.querySelector("#grv_badge_tok");
    badgeBase = panel.querySelector("#grv_badge_base");
    inStart   = panel.querySelector("#grv_start");
    inEnd     = panel.querySelector("#grv_end");
    selFilter = panel.querySelector("#grv_filter");
    btnRun    = panel.querySelector("#grv_run");
    btnXLSX   = panel.querySelector("#grv_xlsx");
    btnCopy   = panel.querySelector("#grv_copy");
    btnCopyLog= panel.querySelector("#grv_copy_log");

    chkAddr   = panel.querySelector("#grv_addr_enable");
    addrBox   = panel.querySelector("#grv_addr_box");
    radAp     = addrBox.querySelector('input[value="apreensao"]');
    radRm     = addrBox.querySelector('input[value="remocao"]');
    radBoth   = addrBox.querySelector('input[value="ambos"]');

    chkPol    = panel.querySelector("#grv_pol_enable");
    polBox    = panel.querySelector("#grv_pol_box");
    chkPolOficial = polBox.querySelector("#grv_pol_oficial");
    chkPolObs     = polBox.querySelector("#grv_pol_obs");

    resL = panel.querySelector("#grv_res_l");
    resR = panel.querySelector("#grv_res_r");
    resT = panel.querySelector("#grv_res_t");
    resB = panel.querySelector("#grv_res_b");

    // Popula filtro (padrão fixo: “No pátio”)
    for (const [val,label] of FILTER_OPTIONS){
      const opt=document.createElement("option"); opt.value=val; opt.textContent=label;
      selFilter.appendChild(opt);
    }
    selFilter.value = "1";

    // Eventos principais
    btnRun.onclick  = onRun;
    btnXLSX.onclick = downloadXLSX;
    btnCopy.onclick = copyTSV;
    btnCopyLog.onclick = ()=>navigator.clipboard.writeText(logEl.value).then(()=>log("Log copiado."),()=>log("Falha ao copiar log."));

    chkAddr.addEventListener("change", ()=>{ addrBox.style.display = chkAddr.checked ? "block" : "none"; });
    chkPol.addEventListener("change",  ()=>{ polBox.style.display  = chkPol.checked  ? "block" : "none"; });

    // Minimizar/Restaurar + persistência
    btnMin.addEventListener("click", toggleMinimize);
    head.addEventListener("dblclick", toggleMinimize);

    // Resize pelas bordas
    attachResize(resL, "L");
    attachResize(resR, "R");
    attachResize(resT, "T");
    attachResize(resB, "B");

    updateBadges();
    setTimeout(tryPerf, 250);

    // APLICA ESTADO INICIAL (persistido)
    setMinimized(STATE.minimized);
  }

  // Aplica estado minimizado/expandido e salva no localStorage
  function setMinimized(flag){
    STATE.minimized = !!flag;
    try { localStorage.setItem(LS_COLLAPSE_KEY, STATE.minimized ? "1" : "0"); } catch {}

    if (!panel || !bodyWrap || !btnMin) return;

    if (STATE.minimized){
      const r = panel.getBoundingClientRect();
      STATE.lastSize.w = r.width; STATE.lastSize.h = r.height;
      bodyWrap.style.display = "none";
      logEl && (logEl.style.display = "none");
      panel.style.height = "auto";
      btnMin.textContent = "+";
      btnMin.title = "Restaurar";
    } else {
      bodyWrap.style.display = "";
      logEl && (logEl.style.display = "");
      panel.style.width  = STATE.lastSize.w + "px";
      panel.style.height = STATE.lastSize.h + "px";
      btnMin.textContent = "–";
      btnMin.title = "Minimizar";
    }
  }
  function toggleMinimize(){ setMinimized(!STATE.minimized); }

  // Redimensionamento pelas bordas
  function attachResize(handle, side){
  let startX=0, startY=0, startRect=null;
  const clamp = (v,min,max)=>Math.min(Math.max(v,min),max);

  const onMove = (e)=>{
    if (!startRect) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const vw = Math.max(document.documentElement.clientWidth,  window.innerWidth  || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    let w = startRect.width;
    let h = startRect.height;
    let left = startRect.left;
    let top  = startRect.top;

    if (side==="R") w = Math.max(320, startRect.width + dx);
    if (side==="L"){ w = Math.max(320, startRect.width - dx); left = startRect.left + dx; }
    if (side==="B") h = Math.max(100, startRect.height + dy);
    if (side==="T"){ h = Math.max(100, startRect.height - dy); top  = startRect.top + dy; }

    const margin = 10; // mantém 10px visíveis
    w = Math.min(w, vw - margin - left);
    h = Math.min(h, vh - margin - top);

    if (side==="L") left = clamp(left, margin, vw - margin - w);
    if (side==="T") top  = clamp(top,  margin, vh - margin - h);

    panel.style.width  = w + "px";
    panel.style.height = h + "px";

    if (side==="L" || side==="T"){
      panel.style.left = left + "px";
      panel.style.top  = top  + "px";
      panel.style.right = "auto";
      panel.style.bottom= "auto";
    }
  };

  const onUp = ()=>{
    startRect=null;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };

  handle.addEventListener("mousedown", (e)=>{
    e.preventDefault(); e.stopPropagation();
    const r = panel.getBoundingClientRect();
    startRect = {left:r.left, top:r.top, width:r.width, height:r.height};
    startX = e.clientX; startY = e.clientY;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
}

  /* ============================ CABEÇALHO DINÂMICO ============================ */
  function buildHeader(includeAddr, origin, polOn, polOf, polObs){
    const base = ["GRV","Placa Original","Placa Ostentada","Chassi","Data da Apreensão","Data da Retirada","Marca/Modelo","Pátio","Vaga","Nº da Chave","Situação"];
    const out = base.slice();
    if (includeAddr){
      const ap = ["Logradouro (apreensão)","Bairro (apreensão)","Cidade (apreensão)","UF (apreensão)","Complemento (apreensão)"];
      const rm = ["Logradouro (remoção)","Bairro (remoção)","Cidade (remoção)","UF (remoção)","Complemento (remoção)"];
      if (origin==="apreensao") out.push(...ap);
      else if (origin==="remocao") out.push(...rm);
      else out.push(...ap, ...rm);
    }
    if (polOn){
      if (polOf){ out.push("Policial apreensor","Matrícula"); }
      if (polObs){ out.push("Policial apreensor (observação)","Matrícula (observação)"); }
    }
    return out;
  }
  function appendAddressIfNeeded(row, item, includeAddr, origin){
    if (!includeAddr) return row;
    if (origin==="apreensao") return row.concat(pickEnderecoFromList(item,"apreensao"));
    if (origin==="remocao")   return row.concat(pickEnderecoFromList(item,"remocao"));
    return row.concat(pickEnderecoFromList(item,"apreensao"), pickEnderecoFromList(item,"remocao"));
  }

  /* ================================= CORE ================================= */
  async function onRun(){
    if (!STATE.authHeader){ log("ERRO: token não capturado."); return; }
    if (!STATE.listBase){ tryPerf(); }
    if (!STATE.listBase){ log("ERRO: base da lista não detectada. Navegue 1 página ou selecione 100 por página."); return; }

    const start = Math.max(1, parseInt(inStart.value||"1",10));
    const end   = Math.max(0, parseInt(inEnd.value||"5",10));
    const filterValue = selFilter.value || "1"; // default No pátio

    const includeAddr = !!chkAddr.checked;
    const origin = includeAddr ? (radAp.checked ? "apreensao" : (radRm.checked ? "remocao" : "ambos")) : "apreensao";

    const includePol = !!chkPol.checked;
    const polOf = includePol && !!chkPolOficial.checked;
    const polObs = includePol && !!chkPolObs.checked;

    const filterLabel = FILTER_OPTIONS.find(f=>f[0]===filterValue)?.[1] || filterValue;
    const addrLabel = includeAddr ? origin : "não";
    const polLabel  = includePol ? (`oficiais=${polOf?"sim":"não"}; obs=${polObs?"sim":"não"}`) : "não";
    log(`Início: ${start} | Fim: ${end||"até zerar"} | Filtro (script/API): ${filterLabel} | Endereço: ${addrLabel} | Policial: ${polLabel}`);
    log(`Base usada: ${STATE.listBase}`);
    if (end>0) log(`Meta: ${end*100} mantidos pelo filtro.`);

    const header = buildHeader(includeAddr, origin, includePol, polOf, polObs);
    const aoa = [header];

    const targetKept = end > 0 ? (end * 100) : null;

    let page=start,total=0,kept=0,empty=0;
    const tasks = []; // fila de detalhes

    while(true){
      if (targetKept != null && kept >= targetKept) break;

      log(`→ Página ${page}…`);
      let items=[];
      try{ items = await getListPage(STATE.listBase, page, filterValue); }
      catch(e){ log(`ERRO API: ${e && e.message || e}`); break; }

      if (!items || items.length===0){
        log(`Página ${page}: 0 itens.`);
        empty++; break;
      }

      empty=0;
      let keptThisPage = 0;
      for (const it of items){
        const code = Number(it?.status);
        if (!passFilter(code, filterValue)) continue;

        const base = baseRow(it);
        const withAddr = appendAddressIfNeeded(base, it, includeAddr, origin);

        const rowIndex = aoa.length;
        aoa.push(withAddr);
        kept++; keptThisPage++;

        if (includePol && (polOf || polObs)){
          tasks.push({rowIndex, item: it});
        }

        if (targetKept != null && kept >= targetKept) break;
      }
      total += items.length;
      log(`✓ ${items.length} itens recebidos; mantidos nesta página: ${keptThisPage}; mantidos acumulados: ${kept}.`);

      if (targetKept != null && kept >= targetKept) break;
      page++; await sleep(30);
    }

    if (includePol && (polOf || polObs) && tasks.length>0){
      log(`[policial] iniciando detalhe para ${tasks.length} linha(s) (2 workers)`);
      await runDetailWorkers(tasks, aoa, {polOf, polObs});
    }

    STATE.rowsAOA = aoa;
    btnXLSX.disabled = false;
    btnCopy.disabled = false;
    log(`Concluído. Itens recebidos (brutos): ${total}. Linhas exportáveis (pós-filtro): ${aoa.length-1}.`);
  }

  // 2 workers fixos para DETALHE
  async function runDetailWorkers(tasks, aoa, opts){
    const {polOf, polObs} = opts;
    let idx = 0;
    const next = ()=> (idx < tasks.length) ? tasks[idx++] : null;

    async function fetchWithRetry(job){
      const MAX = 3;
      for (let a=1; a<=MAX; a++){
        try { return await fetchDetalheByIdOrNumero(job.item); }
        catch(e){
          if (a===MAX) throw e;
          const wait = 400 * a;
          await sleep(wait);
        }
      }
    }

    async function worker(){
      while(true){
        const job = next();
        if (!job) break;
        try{
          const det = await fetchWithRetry(job);
          const cols = [];
          if (polOf){
            const {nome, mat} = getPolicialOficialFromDetalhe(det);
            cols.push(safe(nome), safe(mat));
          }
          if (polObs){
            const obs = det?.observacoes || det?.observacao || det?.observacoesVeiculo || "";
            const {nomeObs, matObs} = parsePolicialFromObservacao(obs);
            cols.push(safe(nomeObs), safe(matObs));
          }
          aoa[job.rowIndex] = aoa[job.rowIndex].concat(cols);
        } catch(e){
          log(`[policial] falha (${e && e.message || e}) em GRV ${job.item?.numero || "?"}`);
          const cols = [];
          if (polOf) cols.push("-----","-----");
          if (polObs) cols.push("-----","-----");
          aoa[job.rowIndex] = aoa[job.rowIndex].concat(cols);
        }
      }
    }
    await Promise.all([worker(), worker()]);
  }

  /* ================================ EXPORTS ================================ */
  function downloadXLSX(){
    if(!STATE.rowsAOA){ log("Nada para exportar."); return; }
    if(!(window.XLSX && XLSX.utils)){ log("Aguarde o módulo XLSX carregar e tente de novo."); return; }
    const ws = XLSX.utils.aoa_to_sheet(STATE.rowsAOA);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GRV");
    const wbout = XLSX.write(wb, {bookType:"xlsx", type:"array"});
    const blob = new Blob([wbout], {type:"application/octet-stream"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `grv_lista_${ts()}.xlsx`;
    a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 400);
  }

  async function copyTSV(){
    if(!STATE.rowsAOA){ log("Nada para copiar."); return; }
    const sanitizeForTSV = (v) => {
      if (v == null) return "";
      return String(v).replace(/\r?\n/g, " ").replace(/\t/g, " ").replace(/\u00A0/g, " ").replace(/\s{2,}/g, " ").trim();
    };
    const tsv = STATE.rowsAOA.map(row => row.map(sanitizeForTSV).join("\t")).join("\r\n");
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const blob = new Blob([tsv], { type: "text/tab-separated-values" });
        const item = new ClipboardItem({ "text/tab-separated-values": blob, "text/plain": blob });
        await navigator.clipboard.write([item]);
        log("Copiado (TSV). Cole no Google Sheets/Excel."); return;
      }
    } catch {}
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(tsv);
        log("Copiado (TSV). Cole no Google Sheets/Excel."); return;
      }
    } catch {}
    try {
      const ta=document.createElement("textarea");
      ta.style.position="fixed"; ta.style.left="-9999px"; ta.value=tsv;
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      const ok=document.execCommand("copy");
      document.body.removeChild(ta);
      log(ok ? "Copiado (TSV). Cole no Google Sheets/Excel."
             : "Falha ao copiar. Selecione e copie manualmente.");
    } catch {
      log("Falha ao copiar. Selecione e copie manualmente.");
    }
  }

  // SheetJS para XLSX
  const s=document.createElement("script");
  s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  document.head.appendChild(s);

  /* ================================= BOOT ================================= */
  function boot(){
    if (document.body) buildPanel();
    else {
      const mo=new MutationObserver(()=>{ if(document.body){ mo.disconnect(); buildPanel(); } });
      mo.observe(document.documentElement||document, {childList:true,subtree:true});
      window.addEventListener("load", ()=>{ if(!panel) buildPanel(); }, {once:true});
    }
  }
  boot();
})();
