"""Generate indexable weekly briefs from collected public metadata."""
import html, json, re
from datetime import date, timedelta
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]; DATA=ROOT/'data'; OUT=ROOT/'insights'; WEEKLY=OUT/'weekly'; BASE='https://www.healtharchive.kr'
def load(path):
    try:return json.loads(path.read_text(encoding='utf-8'))
    except (OSError,json.JSONDecodeError):return []
def load_js(path,var):
    try:text=path.read_text(encoding='utf-8')
    except OSError:return []
    match=re.search(rf'var\s+{var}\s*=\s*(\[.*\]);?\s*$',text,re.S)
    return json.loads(match.group(1)) if match else []
def esc(value):return html.escape(str(value or ''),quote=True)
def page(title,desc,canonical,body,depth='../'):
    return f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)}</title><meta name="description" content="{esc(desc)}"><meta name="robots" content="index,follow,max-snippet:-1"><link rel="canonical" href="{canonical}"><link rel="stylesheet" href="{depth}public-content.css"></head><body><header><nav class="nav"><a class="brand" href="{BASE}/"><b>Health</b>Archive</a><div class="nav-links"><a href="{BASE}/insights/">공개 브리프</a><a href="{BASE}/en/" lang="en">Global inquiry</a></div></nav></header><main>{body}</main><footer>HealthArchive · 공개 자료 기반 실무 인텔리전스</footer></body></html>'''
def product_rows(items):
    return ''.join(f'<div class="row"><span>{esc(x.get("reportDate"))}</span><strong>{esc(x.get("name"))}</strong><span>{esc(x.get("company"))}</span></div>' for x in items) or '<p class="meta">이번 주 수집 항목이 없습니다.</p>'
def link_rows(items):
    return ''.join(f'<a class="row" href="{esc(x.get("link") or x.get("url"))}" target="_blank" rel="noopener"><span>{esc(str(x.get("pubDate") or x.get("year") or "")[:10])}</span><strong>{esc(x.get("title"))}</strong><span>원문 보기</span></a>' for x in items) or '<p class="meta">이번 주 수집 항목이 없습니다.</p>'
def generate():
    OUT.mkdir(exist_ok=True); WEEKLY.mkdir(exist_ok=True)
    products=sorted(load_js(DATA/'products.js','PRODUCTS_DATA'),key=lambda x:x.get('reportDate',''),reverse=True)[:8]
    rules=sorted(load(DATA/'news_mfds.json'),key=lambda x:x.get('pubDate',''),reverse=True)[:6]
    papers=load_js(DATA/'paper_reports.js','PAPER_REPORTS_DATA')[:6]
    monday=date.today()-timedelta(days=date.today().weekday()); slug=monday.isoformat()
    body=f'<span class="eyebrow">Weekly intelligence · {slug}</span><h1>주간 신규 제품·규제·R&amp;D 브리프</h1><p class="lede">건강기능식품 개발자가 먼저 확인할 신규 제품, 식약처 동향과 연구 신호를 공개 데이터에서 선별했습니다.</p><h2>신규 등록 제품</h2><div class="list">{product_rows(products)}</div><h2>규제·정책 신호</h2><div class="list">{link_rows(rules)}</div><h2>R&amp;D 신호</h2><div class="list">{link_rows(papers)}</div><p class="notice">공개 자료 탐색을 돕는 요약이며 규제·법률·투자 자문이 아닙니다. 최종 판단 전 원문과 최신 공고를 확인하세요.</p><div class="cta"><a class="button" href="{BASE}/">HealthArchive 시작하기</a><a class="button secondary" href="{BASE}/en/">Global co-development</a></div>'
    brief=page(f'{slug} 건강기능식품 주간 브리프 | HealthArchive','신규 등록 제품, 식약처 규제 동향과 건강기능식품 R&D 신호를 정리한 주간 브리프.',f'{BASE}/insights/weekly/{slug}.html',body,'../../')
    (WEEKLY/f'{slug}.html').write_text(brief,encoding='utf-8'); (WEEKLY/'latest.html').write_text(brief.replace(f'{slug}.html','latest.html'),encoding='utf-8')
    archives=sorted(WEEKLY.glob('20??-??-??.html'),reverse=True)
    cards=''.join(f'<article class="card"><span class="eyebrow">Weekly</span><h3><a href="weekly/{p.name}">{p.stem} 브리프</a></h3><p>신규 제품·규제·R&amp;D 업데이트</p></article>' for p in archives[:24])
    index=f'<span class="eyebrow">Public intelligence</span><h1>건강기능식품 개발 공개 브리프</h1><p class="lede">신규 제품, 규제 변화와 연구 신호를 주간 단위로 연결합니다. 상세 데이터베이스와 판정 도구는 로그인 후 제공됩니다.</p><div class="grid">{cards}</div><div class="cta"><a class="button" href="weekly/latest.html">최신 브리프 보기</a><a class="button secondary" href="../en/">해외 원료사 문의</a></div>'
    (OUT/'index.html').write_text(page('건강기능식품 개발 공개 브리프 | HealthArchive','신규 제품, 규제 변화와 R&D 신호를 연결한 건강기능식품 개발 주간 브리프.',f'{BASE}/insights/',index),encoding='utf-8')
    paths=[('/', 'daily','1.0'),('/insights/','weekly','0.9'),('/insights/weekly/latest.html','weekly','0.8'),(f'/insights/weekly/{slug}.html','weekly','0.8'),('/en/','monthly','0.8')]
    entries=''.join(f'  <url>\n    <loc>{BASE}{p}</loc>\n    <lastmod>{date.today()}</lastmod>\n    <changefreq>{freq}</changefreq>\n    <priority>{priority}</priority>\n  </url>\n' for p,freq,priority in paths)
    entries+=f'  <url>\n    <loc>https://m.healtharchive.kr/</loc>\n    <lastmod>{date.today()}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n'
    (ROOT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+entries+'</urlset>\n',encoding='utf-8')
if __name__=='__main__':generate()
