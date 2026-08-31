#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const CONTENT_DIR = path.join(process.cwd(), 'src', 'content', 'blog');

const args = process.argv.slice(2);

const usage = () => {
	console.log(`用法:
  npm run new:post -- "文章标题"

可选参数:
  --slug <slug>        自定义文件名 / 文章路径
  --tags <a,b>         设置标签，默认：随笔
  --tag <tag>          追加一个标签，可重复
  --date <YYYY-MM-DD>  设置发布日期，默认今天
  --draft             创建为草稿
  --featured          标记为首页推荐
  --mdx               创建 .mdx 文件，默认 .md
  --dry-run           只预览将创建的文件，不写入

示例:
  npm run new:post -- "今天学到的事" --tags "随笔,生活"
  npm run new:post -- "Astro 笔记" --slug astro-notes --tag 技术 --draft
`);
};

const readOptionValue = (index, name) => {
	const value = args[index + 1];
	if (!value || value.startsWith('--')) {
		throw new Error(`${name} 需要一个值`);
	}
	return value;
};

const formatLocalDate = (date = new Date()) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const yamlQuote = (value) => `'${String(value).replaceAll("'", "''")}'`;

const slugify = (value) => {
	const slug = String(value)
		.normalize('NFKC')
		.trim()
		.toLowerCase()
		.replace(/[\s_]+/g, '-')
		.replace(/[^\p{Letter}\p{Number}-]+/gu, '')
		.replace(/-{2,}/g, '-')
		.replace(/^-|-$/g, '');

	return slug || `post-${formatLocalDate()}`;
};

const resolveUniqueFile = (slug, extension) => {
	let suffix = 0;
	let filePath;

	do {
		const name = suffix === 0 ? slug : `${slug}-${suffix + 1}`;
		filePath = path.join(CONTENT_DIR, `${name}.${extension}`);
		suffix += 1;
	} while (existsSync(filePath));

	return filePath;
};

const options = {
	date: formatLocalDate(),
	draft: false,
	featured: false,
	extension: 'md',
	dryRun: false,
	tags: [],
	slug: '',
};

const titleParts = [];

try {
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];

		switch (arg) {
			case '--help':
			case '-h':
				usage();
				process.exit(0);
				break;
			case '--slug':
				options.slug = slugify(readOptionValue(index, '--slug'));
				index += 1;
				break;
			case '--tags':
				options.tags.push(
					...readOptionValue(index, '--tags')
						.split(',')
						.map((tag) => tag.trim())
						.filter(Boolean),
				);
				index += 1;
				break;
			case '--tag':
				options.tags.push(readOptionValue(index, '--tag').trim());
				index += 1;
				break;
			case '--date':
				options.date = readOptionValue(index, '--date');
				index += 1;
				break;
			case '--draft':
				options.draft = true;
				break;
			case '--featured':
				options.featured = true;
				break;
			case '--mdx':
				options.extension = 'mdx';
				break;
			case '--dry-run':
				options.dryRun = true;
				break;
			default:
				if (arg.startsWith('--')) throw new Error(`未知参数：${arg}`);
				titleParts.push(arg);
		}
	}

	if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
		throw new Error('--date 格式应为 YYYY-MM-DD');
	}

	const title = titleParts.join(' ').trim();
	if (!title) {
		usage();
		process.exit(1);
	}

	const tags = [...new Set(options.tags.filter(Boolean))];
	if (!tags.length) tags.push('随笔');

	const slug = options.slug || slugify(title);
	const filePath = resolveUniqueFile(slug, options.extension);
	const relativePath = path.relative(process.cwd(), filePath);

	const content = `---
title: ${yamlQuote(title)}
description: ${yamlQuote('这里写文章摘要')}
pubDate: ${yamlQuote(options.date)}
# heroImage: ${yamlQuote('../../assets/cover.jpg')}
tags: [${tags.map(yamlQuote).join(', ')}]
draft: ${options.draft}
featured: ${options.featured}
---

正文从这里开始。
`;

	if (options.dryRun) {
		console.log(`将创建：${relativePath}\n`);
		console.log(content);
		process.exit(0);
	}

	await mkdir(CONTENT_DIR, { recursive: true });
	await writeFile(filePath, content, { flag: 'wx' });

	console.log(`已创建：${relativePath}`);
	console.log(`预览文章：/blog/${path.basename(filePath, `.${options.extension}`)}/`);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
