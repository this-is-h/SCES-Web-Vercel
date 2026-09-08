# SCES-Web-Vercel — 预览版门户

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
    - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
    - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
    - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
    - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
pnpm install
```

### Compile and Hot-Reload for Development

```sh
pnpm dev
```

### Type-Check, Compile and Minify for Production

```sh
pnpm build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
pnpm test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
pnpm lint
```

## Excel 导出

系统支持基于模板 `public/example.xlsx` 的双表导出能力，固定工作表为“总表”“基础分分表”，支持模板微调后的自动字段重建与变更日志记录。

### 命令脚本

```sh
npm run export:class
npm run export:grade
```

可选参数：

```sh
node ./src/utils/excel/runner.js class --students ./tmp/students.json --out ./tmp/class.xlsx
node ./src/utils/excel/runner.js grade --students ./tmp/students.json --out ./tmp/grade.xlsx
```

### 测试与覆盖率

```sh
npm run test:coverage
npm run test:coverage:nyc
```

Excel 相关核心测试位于 `src/utils/excel/excelFlow.test.js`，覆盖导出公式一致性场景。
