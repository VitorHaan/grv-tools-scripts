// ==UserScript==
// @name         GRV Tools com Endereço e Policial 3 em 1 v1.4.3
// @namespace    vitor.grv.tools
// @version      1.4.3
// @description  LISTA (canônica) + ENDEREÇO (Apreensão/Remoção/Ambos – opcional) + POLICIAL (opcional, via DETALHE). Situação por status, datas sem .000000. Exporta XLSX/TSV. UI aprovada (padrão: filtro "No pátio"; páginas 1→5; sem atalhos). Força 100 por página, aplica filtro de Situação JÁ NA API e coleta exatamente N×100 mantidos.
// @match        https://intranet.consorciorioparkingcarioca.com/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/VitorHaan/grv-tools-scripts/main/dist/grv_tools_com_endereco_e_policial_3_em_1_v1.4.3.user.js
// @downloadURL  https://raw.githubusercontent.com/VitorHaan/grv-tools-scripts/main/dist/grv_tools_com_endereco_e_policial_3_em_1_v1.4.3.user.js
// ==/UserScript==

(function(){"use strict";
  // Ofuscado com empacotamento Base64 (acento-safe).
  const b="(BASE64 REMOVIDO PARA BREVIDADE NO EXEMPLO, SUBSTITUÍDO PELO CONTEÚDO REAL ABAIXO)";
  const bin = (typeof atob === "function") ? atob(b) : (typeof Buffer !== "undefined" ? Buffer.from(b,"base64").toString("binary") : b);
  let src;
  try { src = new TextDecoder("utf-8").decode(Uint8Array.from(bin, c => c.charCodeAt(0))); }
  catch(e) { try { src = decodeURIComponent(escape(bin)); } catch(_) { src = bin; } }
  (0, eval)(src);
})();
