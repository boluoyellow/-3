# 拾光 · 校园寻物（Chrome WEB 版）

基于 HTML、CSS 和 JavaScript 的校园失物招领网页，支持发布寻物与招领、搜索筛选、查看详情、展示联系方式和更新状态。

## 运行方式

1. 点击仓库 **Code → Download ZIP**，解压整个文件夹。也可[直接下载 ZIP](https://github.com/boluoyellow/-3/archive/refs/heads/main.zip)。
2. 用 **Google Chrome 普通模式**打开解压后的 `index.html`。右键文件 → 打开方式 → Google Chrome 即可。
3. 无需安装 Node.js、编译或启动服务器。运行时需保留 `js/`、`assets/` 和 `styles.css`，不能只下载 HTML 文件。

适用于桌面 Chrome，小屏幕采用自适应布局。

## 使用流程

1. 首页查看示例，搜索“耳机”或“图书馆”，尝试类型、分类与状态筛选。
2. 点击“我丢了东西”或“我捡到东西”，填写名称、日期、地点、描述、联系方式，可上传一张照片。
3. 首次发布时设置昵称。发布成功后直接展示物品详情，初始状态为“寻物中”或“招领中”，不会自动变为已完成。
4. 刷新网页，检查文字、照片、昵称仍然保留。
5. 从“我的发布”打开详情，确认标记“已找回/已归还”；可重新开启或删除。删除前有二次确认。
6. 从首页打开其他人的**示例**信息，查看并复制虚构的联系方式。已完成信息不再提供联系按钮。

默认广场只展示进行中的信息；要查看已完成记录，请调整“物品状态”。示例信息不能删除或变更状态。表单会自动保留未发布草稿。

## 数据存储

- 当前版本使用本地存储，不支持多用户联网同步。
- 发布信息、昵称、压缩照片和草稿保存在当前 Chrome 的 `localStorage`。不同电脑、浏览器配置、隐身窗口不共享数据；移动文件位置或改用 HTTP 地址也可能使用不同的存储区域。
- 清除浏览器站点数据会删除本地发布记录和草稿。
- 昵称用于展示，记录归属由浏览器生成的本地标识区分，不提供账号认证。
- 照片支持 JPG/PNG/WebP，原文件最大 5 MB，最长边压缩至 1000 像素。存储空间不足时提示保存失败。
- 示例以“示例”标签标注，联系人和联系方式均为虚构。

## 目录说明

```text
index.html             页面入口、导航和弹窗
styles.css             桌面/手机自适应样式
assets/                原创 SVG 标志、校园插画（无需联网）
js/
  store.js             存储、数据校验、搜索、状态与归属规则
  app.js               页面路由、表单、照片处理和交互
tests/
  store.test.js        Node 内置测试：正常/异常/边界数据
  chrome.e2e.cjs       可选 Chrome 自动化流程验证
scripts/serve.js        可选本地预览服务
docs/
  testing.md           已执行的验证与局限
  PSP.md               PSP 记录表
package.json           开发检查命令（使用页面不依赖它）
```

`js/store.js` 不依赖页面，以便单元测试；`js/app.js` 只负责展示及用户交互。使用经典脚本和相对路径，不用 ES Module、CDN、远程接口或网络字体，所以可以直接通过 `file://` 打开。

## 核心流程

```text
填写发布表单 → 校验必填/长度/日期/图片 → 未设昵称则设置昵称
    → 保存本地记录（open）→ 展示详情 → 我的发布更新为 closed

首页 → 组合筛选（关键词 + 类型 + 分类 + 状态）→ 查看详情
    → 示例/非本人进行中记录：显示联系方式
    → 本人记录：确认后完成、重新开启或删除
```

## 开发与测试（可选）

需要 Node.js 18 或以上。无第三方运行依赖，不必执行 `npm install`。

```sh
npm test
npm run check
npm start
```

前两项运行单元测试及语法检查。`npm start` 仅用于可选预览，打开 `http://127.0.0.1:4173`；结束时 Ctrl+C。通过此地址打开时的数据与直接双击 HTML 的数据互不共享。

Chrome 自动化测试需要 Playwright；正常使用网页无需安装：

```sh
npm install --no-save --package-lock=false playwright
node tests/chrome.e2e.cjs
```

默认使用 Windows 标准 Chrome 安装路径；其他平台可通过 `CHROME_PATH` 指定 Chrome 可执行文件。已有 Playwright 环境时，可用 `PLAYWRIGHT_MODULE` 指定其模块路径。测试使用独立浏览器上下文。

测试说明见 [docs/testing.md](docs/testing.md)，PSP 表见 [docs/PSP.md](docs/PSP.md)。
