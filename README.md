# kkkk

基于 Astro、Markdown 与 Tailwind CSS 的个人博客，通过 GitHub Actions 自动部署到 GitHub Pages 用户站。

## 技术栈

- Astro 7：静态站点生成、内容集合与图片优化
- Markdown / MDX：文章写作
- Tailwind CSS 4：样式工具链
- GitHub Pages：免费静态托管
- GitHub Actions：推送到 `main` 后自动构建发布

## 项目结构

```text
.
├── .github/workflows/       # GitHub Pages 自动部署
├── public/                  # 不经处理的静态资源
├── src/
│   ├── assets/              # 构建期优化的图片与字体
│   ├── components/          # 可复用 UI 组件
│   ├── content/blog/        # Markdown / MDX 文章
│   ├── layouts/             # 页面与文章布局
│   ├── pages/               # 文件路由
│   ├── styles/              # 全局样式与 Tailwind 入口
│   ├── consts.ts            # 站点名称、作者和描述
│   └── content.config.ts    # 文章字段约束
├── astro.config.mjs         # Astro、Sitemap、Tailwind 配置
└── package.json
```

## 本地开发

项目使用 Node.js 24。nvm 已安装时可直接运行：

```bash
nvm use
npm install
npm run dev
```

访问 `http://localhost:4321`。生产构建与预览：

```bash
npm run build
npm run preview
```

## 写一篇文章

在 `src/content/blog/` 新建 `.md` 或 `.mdx` 文件：

```md
---
title: '文章标题'
description: '用于文章列表和 SEO 的摘要'
pubDate: '2026-08-28'
updatedDate: '2026-08-29' # 可选
heroImage: '../../assets/cover.jpg' # 可选
tags: ['技术', 'Astro']
draft: false
featured: false
---

正文从这里开始。
```

`draft: true` 的文章仅在本地开发环境显示，不会进入生产页面或 RSS。`featured: true` 的第一篇文章会出现在首页推荐位。

## 个性化

站点名称、作者与简介集中在 `src/consts.ts`。替换文章封面时，建议把图片放入 `src/assets/`，让 Astro 自动优化尺寸与格式。

## 部署到 GitHub Pages

1. 在 GitHub 新建名为 `<你的用户名>.github.io` 的公开仓库。
2. 将本项目推送到仓库的 `main` 分支。
3. 打开仓库 **Settings → Pages**，把 **Source** 设置为 **GitHub Actions**。
4. 等待 Actions 中的 `Deploy to GitHub Pages` 完成。

工作流会根据 `github.repository_owner` 自动生成站点地址，无需手动修改 `astro.config.mjs`。线上地址为 `https://<你的用户名>.github.io/`。
