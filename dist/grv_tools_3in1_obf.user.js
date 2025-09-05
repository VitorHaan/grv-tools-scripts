// ==UserScript==
// @name         GRV Tools — 3 em 1 (mascarado, single-file) v1.4.0
// @namespace    vitor.grv.tools
// @version      1.4.0
// @description  Código mascarado (Base64+XOR) executado via loader interno (compatível Tampermonkey).
// @match        https://intranet.consorciorioparkingcarioca.com/*
// @run-at       document-start
// @grant        none
// @updateURL    https://vitorhaan.github.io/grv-tools-scripts/dist/grv_tools_3in1_obf.user.js
// @downloadURL  https://vitorhaan.github.io/grv-tools-scripts/dist/grv_tools_3in1_obf.user.js
// @noframes
// ==/UserScript==
(function(){
  'use strict';
  // Payload ofuscado (Base64 do conteúdo XOR)
  var B64 = '';
  var KEY = 'GRV!2025#x';

  // Decodifica Base64 para bytes
  function fromB64(b64){
    var bin = atob(String(b64||'').replace(/\\s+/g,''));
    var len = bin.length, out = new Uint8Array(len);
    for (var i=0;i<len;i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // XOR com chave repetida
  function xorBytes(bytes, keyStr){
    var enc = new TextEncoder();
    var k = enc.encode(keyStr);
    var out = new Uint8Array(bytes.length);
    for (var i=0;i<bytes.length;i++) out[i] = bytes[i] ^ k[i % k.length];
    return out;
  }
  // Converte bytes UTF-8 para string
  function bytesToStr(bytes){
    return new TextDecoder('utf-8').decode(bytes);
  }

  try{
    var code = bytesToStr(xorBytes(fromB64(B64), KEY));
    (new Function(code))();
  } catch(e){
    console.error('[GRV Tools obf] Erro ao iniciar:', e);
  }
})();