# GRV Tools — Tampermonkey via GitHub Pages

Este repositório publica scripts Tampermonkey via GitHub Pages.

## Como usar

1. Habilite GitHub Pages em **Settings → Pages** com `Deploy from branch` (branch `main`, pasta `/root`).
2. Ajuste o cabeçalho do script em `dist/grv_tools_lista_v6_0_0.user.js` para o seu usuário do GitHub:
   ```js
   // @updateURL    https://SEU_USUARIO.github.io/grv-tools-scripts/dist/grv_tools_lista_v6_0_0.user.js
   // @downloadURL  https://SEU_USUARIO.github.io/grv-tools-scripts/dist/grv_tools_lista_v6_0_0.user.js
   ```
3. Acesse:
   ```
   https://SEU_USUARIO.github.io/grv-tools-scripts/dist/grv_tools_lista_v6_0_0.user.js
   ```
   O Tampermonkey abrirá a tela de instalação/atualização.

## Sobre esta build

- Baseado no arquivo canônico `grv_tools_lista_nucleo_limpo_v6_0_0.user.js`.
- Minificado de forma simples (comentários removidos, espaços comprimidos), preservando o cabeçalho Tampermonkey.
- Hash SHA-256 do build atual: `9ec778c56e93ccec4092455bc36e282f766d90e52af820d2c113f9383a31e598`

> Dica: se quiser uma ofuscação mais forte, rode `javascript-obfuscator` localmente antes de publicar.
