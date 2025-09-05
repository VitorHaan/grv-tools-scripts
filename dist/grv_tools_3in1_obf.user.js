// ==UserScript==
// @name         GRV Tools — 3 em 1 (mascarado, single-file) v1.4.0
// @namespace    vitor.grv.tools
// @version      1.4.0
// @description  Código mascarado (Base64+XOR) executado sem eval (fallback via blob:). Compatível com CSP estrita.
// @match        https://intranet.consorciorioparkingcarioca.com/*
// @run-at       document-start
// @grant        none
// @inject-into  page
// @updateURL    https://vitorhaan.github.io/grv-tools-scripts/dist/grv_tools_3in1_obf.user.js
// @downloadURL  https://vitorhaan.github.io/grv-tools-scripts/dist/grv_tools_3in1_obf.user.js
// @noframes
// ==/UserScript==
(function(){
  'use strict';

  // Payload ofuscado (Base64 do conteúdo XOR)
  var B64 = '';
  var KEY = 'GRV!2025#x';

  // --- Polyfills TextEncoder/TextDecoder (para ambientes restritos) ---
  var _TE = (typeof TextEncoder !== 'undefined') ? new TextEncoder() : { encode: function(str){
    var utf8 = [], i=0, c;
    for (i=0; i<str.length; i++){
      c = str.charCodeAt(i);
      if (c < 128) utf8.push(c);
      else if (c < 2048) utf8.push((c>>6)|192, (c&63)|128);
      else utf8.push((c>>12)|224, ((c>>6)&63)|128, (c&63)|128);
    }
    return new Uint8Array(utf8);
  }};
  var _TD = (typeof TextDecoder !== 'undefined') ? new TextDecoder('utf-8') : { decode: function(bytes){
    var out = '', i=0, c, c2, c3;
    while (i < bytes.length){
      c = bytes[i++];
      if (c < 128) out += String.fromCharCode(c);
      else if (c > 191 && c < 224) { c2 = bytes[i++]; out += String.fromCharCode(((c&31)<<6) | (c2&63)); }
      else { c2 = bytes[i++]; c3 = bytes[i++]; out += String.fromCharCode(((c&15)<<12) | ((c2&63)<<6) | (c3&63)); }
    }
    return out;
  }};

  // --- Base64 -> bytes ---
  function fromB64(b64){
    var clean = String(b64||'').replace(/^data:[^,]+,/, '').replace(/\\s+/g,'');
    var bin = atob(clean);
    var len = bin.length, out = new Uint8Array(len);
    for (var i=0;i<len;i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // --- XOR com chave repetida ---
  function xorBytes(bytes, keyStr){
    var k = _TE.encode(keyStr), out = new Uint8Array(bytes.length);
    for (var i=0;i<bytes.length;i++) out[i] = bytes[i] ^ k[i % k.length];
    return out;
  }

  // --- bytes UTF-8 -> string ---
  function bytesToStr(bytes){ return _TD.decode(bytes); }

  // --- Execução segura (sem depender de 'unsafe-eval') ---
  function runInPage(code){
    try {
      // 1) Tenta direto (rápido). Alguns ambientes permitem Function.
      (new Function(code))();
      return;
    } catch (e1) {
      // 2) Fallback robusto: script via blob: (bypassa policies contra eval/inline)
      try {
        var blob = new Blob([code], {type:'text/javascript'});
        var url  = URL.createObjectURL(blob);
        var s    = document.createElement('script');
        s.src    = url;
        (document.head || document.documentElement).appendChild(s);
        s.onload = function(){ try{ URL.revokeObjectURL(url); s.remove(); }catch(_e){} };
      } catch (e2){
        console.error('[GRV Tools obf] Falha ao injetar via blob:', e2, ' — erro original:', e1);
      }
    }
  }

  try{
    var code = bytesToStr(xorBytes(fromB64(B64), KEY));
    runInPage(code);
  } catch(e){
    console.error('[GRV Tools obf] Erro ao iniciar:', e);
  }
})();
