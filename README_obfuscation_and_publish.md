# Publicação do UserScript (GRV Tools 3-em-1)

Este pacote contém:

- `dist/grv_tools_com_endereco_e_policial_3_em_1_1_4_0.user.js` — **versão ofuscada** (loader Base64) pronta para publicar no GitHub Pages.
- `src/GRV Tools com Endereço e Policial 3 em 1 v1.4.0-1.4.0.user.js` — cópia do código-fonte original (não publicar se quiser manter privado).

## URL de instalação (Tampermonkey)

Use este link (abre a tela de instalação do Tampermonkey):

```
https://www.tampermonkey.net/script_installation.php#url=https://vitorhaan.github.io/grv-tools-scripts/dist/grv_tools_com_endereco_e_policial_3_em_1_1_4_0.user.js
```

> Dica: compartilhe exatamente o link acima no WhatsApp.

## Como publicar no GitHub

1. Crie o repositório `grv-tools-scripts` no GitHub (ou use o existente).
2. Faça upload do arquivo `dist/grv_tools_com_endereco_e_policial_3_em_1_1_4_0.user.js`.
3. Ative o **GitHub Pages** nas configurações do repositório:
   - *Settings* → *Pages* → *Source*: `Deploy from a branch`
   - *Branch*: `main` (ou `master`) e pasta `/root` (ou `/docs` se preferir).
   - Salve.
4. Após alguns minutos, sua página estará no domínio:
   - `https://vitorhaan.github.io/grv-tools-scripts/`
5. O arquivo publicado ficará acessível por:
   - `https://vitorhaan.github.io/grv-tools-scripts/dist/grv_tools_com_endereco_e_policial_3_em_1_1_4_0.user.js`
6. Compartilhe o link de instalação do Tampermonkey:
   - `https://www.tampermonkey.net/script_installation.php#url=https://vitorhaan.github.io/grv-tools-scripts/dist/grv_tools_com_endereco_e_policial_3_em_1_1_4_0.user.js`

## Observações sobre ofuscação

- A técnica usada aqui envolve empacotar o script original em Base64 e carregá-lo com `eval(atob(...))`. 
- Isso **não é inviolável**, mas **desestimula** a inspeção casual e atende cenários onde se deseja ocultar a lógica do código dos usuários finais.
- Para ofuscação mais forte, use ferramentas como:
  - [`javascript-obfuscator`](https://github.com/javascript-obfuscator/javascript-obfuscator) (CLI/Node)
  - `terser` com compressão e mangling agressivos

### Com `javascript-obfuscator` (mais forte)

```bash
npm i -g javascript-obfuscator
javascript-obfuscator "src/GRV Tools com Endereço e Policial 3 em 1 v1.4.0-1.4.0.user.js" \
  --output "dist/grv_tools_com_endereco_e_policial_3_em_1_1_4_0.user.js" \
  --compact true --control-flow-flattening true --dead-code-injection true \
  --self-defending true --unicode-escape-sequence true --identifier-names-generator mangled
```

> **Importante:** Preserve sempre o *bloco de metadados* do Tampermonkey (`// ==UserScript== ... ==/UserScript==`) no topo do arquivo final, e mantenha as diretivas `@updateURL` e `@downloadURL` apontando para o endereço do GitHub Pages.
