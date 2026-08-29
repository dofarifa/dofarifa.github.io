<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output method="html" encoding="UTF-8" indent="yes"/>

	<xsl:template match="/">
		<html lang="zh-CN">
			<head>
				<meta charset="utf-8"/>
				<meta name="viewport" content="width=device-width, initial-scale=1"/>
				<title><xsl:value-of select="/rss/channel/title"/> RSS</title>
				<style>
					:root { color-scheme: light dark; --paper: #f8f7fb; --surface: #ffffff; --ink: #272636; --muted: #696779; --accent: #6c5fc7; --soft: #eeebff; --line: rgba(39, 38, 54, .12); }
					@media (prefers-color-scheme: dark) { :root { --paper: #181722; --surface: #242330; --ink: #f5f2fb; --muted: #bbb7c8; --accent: #a99cf5; --soft: #2d2942; --line: rgba(245, 242, 251, .13); } }
					* { box-sizing: border-box; }
					body { margin: 0; background: radial-gradient(circle at 86% 8%, var(--soft), transparent 28rem), var(--paper); color: var(--ink); font-family: "LXGW WenKai Screen", "Noto Serif SC", "Songti SC", "PingFang SC", "Microsoft YaHei", serif; line-height: 1.7; }
					main { width: min(900px, calc(100% - 2rem)); margin: 0 auto; padding: clamp(2rem, 8vh, 5rem) 0; }
					header { padding: clamp(1.6rem, 5vw, 3rem); border-radius: 1.5rem; background: linear-gradient(135deg, var(--soft), color-mix(in srgb, var(--surface) 70%, var(--soft))); box-shadow: 0 24px 64px rgba(71, 64, 112, .14); }
					h1 { margin: 0; font-size: clamp(2rem, 6vw, 4rem); letter-spacing: -.03em; line-height: 1.1; }
					p { margin: .75rem 0 0; color: var(--muted); }
					.hint { margin-top: 1.2rem; padding: .9rem 1rem; border: 1px solid var(--line); border-radius: 1rem; background: color-mix(in srgb, var(--surface) 82%, transparent); color: var(--ink); font-size: .95rem; }
					section { display: grid; gap: .75rem; margin-top: 1.25rem; }
					article { padding: 1rem 1.1rem; border: 1px solid var(--line); border-radius: 1rem; background: var(--surface); }
					article a { color: var(--ink); font-size: 1.05rem; font-weight: 750; text-decoration: none; }
					article a:hover { color: var(--accent); }
					time { display: block; margin-top: .25rem; color: var(--muted); font-size: .78rem; }
				</style>
			</head>
			<body>
				<main>
					<header>
						<h1><xsl:value-of select="/rss/channel/title"/></h1>
						<p><xsl:value-of select="/rss/channel/description"/></p>
						<p class="hint">这是 RSS 订阅源。把当前页面地址复制到 RSS 阅读器，就能自动接收新文章。</p>
					</header>
					<section>
						<xsl:for-each select="/rss/channel/item">
							<article>
								<a>
									<xsl:attribute name="href"><xsl:value-of select="link"/></xsl:attribute>
									<xsl:value-of select="title"/>
								</a>
								<time><xsl:value-of select="pubDate"/></time>
							</article>
						</xsl:for-each>
					</section>
				</main>
			</body>
		</html>
	</xsl:template>
</xsl:stylesheet>
