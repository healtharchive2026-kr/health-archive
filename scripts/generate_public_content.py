"""Generate indexable weekly briefs from collected public metadata."""
import html, json, re
from datetime import date, timedelta
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]; DATA=ROOT/'data'; OUT=ROOT/'insights'; WEEKLY=OUT/'weekly'; GUIDE=ROOT/'ingredient-development'; BASE='https://www.healtharchive.kr'
def load(path):
    try:return json.loads(path.read_text(encoding='utf-8'))
    except (OSError,json.JSONDecodeError):return []
def load_js(path,var):
    try:text=path.read_text(encoding='utf-8')
    except OSError:return []
    match=re.search(rf'var\s+{var}\s*=\s*(\[.*\]);?\s*$',text,re.S)
    return json.loads(match.group(1)) if match else []
def esc(value):return html.escape(str(value or ''),quote=True)
def page(title,desc,canonical,body,depth='../',schema=None):
    structured=f'<script type="application/ld+json">{json.dumps(schema,ensure_ascii=False,separators=(",",":"))}</script>' if schema else ''
    return f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)}</title><meta name="description" content="{esc(desc)}"><meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large"><link rel="canonical" href="{canonical}">{structured}<link rel="stylesheet" href="{depth}public-content.css"></head><body><header><nav class="nav"><a class="brand" href="{BASE}/"><b>Health</b>Archive</a><div class="nav-links"><a href="{BASE}/ingredient-development/">원료 개발 가이드</a><a href="{BASE}/insights/">공개 브리프</a><a href="{BASE}/en/" lang="en">Global inquiry</a></div></nav></header><main>{body}</main><footer>HealthArchive · 공개 자료 기반 실무 인텔리전스</footer></body></html>'''
def product_rows(items):
    return ''.join(f'<div class="row"><span>{esc(x.get("reportDate"))}</span><strong>{esc(x.get("name"))}</strong><span>{esc(x.get("company"))}</span></div>' for x in items) or '<p class="meta">이번 주 수집 항목이 없습니다.</p>'
def link_rows(items):
    return ''.join(f'<a class="row" href="{esc(x.get("link") or x.get("url"))}" target="_blank" rel="noopener"><span>{esc(str(x.get("pubDate") or x.get("year") or "")[:10])}</span><strong>{esc(x.get("title"))}</strong><span>원문 보기</span></a>' for x in items) or '<p class="meta">이번 주 수집 항목이 없습니다.</p>'
def generate():
    OUT.mkdir(exist_ok=True); WEEKLY.mkdir(exist_ok=True); GUIDE.mkdir(exist_ok=True)
    products=sorted(load_js(DATA/'products.js','PRODUCTS_DATA'),key=lambda x:x.get('reportDate',''),reverse=True)[:8]
    rules=sorted(load(DATA/'news_mfds.json'),key=lambda x:x.get('pubDate',''),reverse=True)[:6]
    papers=load_js(DATA/'paper_reports.js','PAPER_REPORTS_DATA')[:6]
    monday=date.today()-timedelta(days=date.today().weekday()); slug=monday.isoformat()
    body=f'<span class="eyebrow">Weekly intelligence · {slug}</span><h1>주간 신규 제품·규제·R&amp;D 브리프</h1><p class="lede">건강기능식품 개발자가 먼저 확인할 신규 제품, 식약처 동향과 연구 신호를 공개 데이터에서 선별했습니다.</p><h2>신규 등록 제품</h2><div class="list">{product_rows(products)}</div><h2>규제·정책 신호</h2><div class="list">{link_rows(rules)}</div><h2>R&amp;D 신호</h2><div class="list">{link_rows(papers)}</div><p class="notice">공개 자료 탐색을 돕는 요약이며 규제·법률·투자 자문이 아닙니다. 최종 판단 전 원문과 최신 공고를 확인하세요.</p><div class="cta"><a class="button" href="{BASE}/">HealthArchive 시작하기</a><a class="button secondary" href="{BASE}/en/">Global co-development</a></div>'
    brief=page(f'{slug} 건강기능식품 주간 브리프 | HealthArchive','신규 등록 제품, 식약처 규제 동향과 건강기능식품 R&D 신호를 정리한 주간 브리프.',f'{BASE}/insights/weekly/{slug}.html',body,'../../')
    (WEEKLY/f'{slug}.html').write_text(brief,encoding='utf-8')
    latest=brief.replace('content="index,follow,max-snippet:-1,max-image-preview:large"','content="noindex,follow"')
    (WEEKLY/'latest.html').write_text(latest,encoding='utf-8')
    archives=sorted(WEEKLY.glob('20??-??-??.html'),reverse=True)
    cards=''.join(f'<article class="card"><span class="eyebrow">Weekly</span><h3><a href="weekly/{p.name}">{p.stem} 브리프</a></h3><p>신규 제품·규제·R&amp;D 업데이트</p></article>' for p in archives[:24])
    index=f'<span class="eyebrow">Public intelligence</span><h1>건강기능식품 개발 공개 브리프</h1><p class="lede">신규 제품, 규제 변화와 연구 신호를 주간 단위로 연결합니다. 상세 데이터베이스와 판정 도구는 로그인 후 제공됩니다.</p><div class="grid">{cards}</div><div class="cta"><a class="button" href="weekly/{slug}.html">최신 브리프 보기</a><a class="button secondary" href="../en/">해외 원료사 문의</a></div>'
    (OUT/'index.html').write_text(page('건강기능식품 개발 공개 브리프 | HealthArchive','신규 제품, 규제 변화와 R&D 신호를 연결한 건강기능식품 개발 주간 브리프.',f'{BASE}/insights/',index),encoding='utf-8')
    guide_desc='건강기능식품 연구원과 원료 개발자를 위한 개별인정원료 개발 절차, 안전성·기능성·기준규격·인체적용시험 자료 구성 실무 가이드.'
    guide_body='''<span class="eyebrow">Ingredient development guide</span><h1>건강기능식품 원료 개발과 개별인정원료 연구 실무</h1><p class="lede">건강기능식품 연구원과 개발자가 원재료 검토부터 개별인정원료 신청까지 확인해야 할 개발 단계와 근거자료를 한 흐름으로 정리했습니다.</p><h2>원료 개발 사전검토</h2><div class="grid"><article class="card"><h3>원재료와 식용 근거</h3><p>기원, 사용 부위, 국내외 식용 이력, 섭취 형태와 식품원료 등재 여부를 확인합니다.</p></article><article class="card"><h3>제조공정과 기준규격</h3><p>추출·농축·정제 공정, 지표성분, 규격 설정, 시험법과 제조 일관성을 검토합니다.</p></article><article class="card"><h3>안전성과 섭취량</h3><p>독성, 상호작용, 이상사례, 섭취근거와 일일섭취량 설정에 필요한 자료를 구성합니다.</p></article></div><h2>개별인정원료 개발 자료 구성</h2><div class="list"><div class="row"><span>01 · Identity</span><strong>원료의 기원·특성 및 제조방법</strong><span>동질성·표준화</span></div><div class="row"><span>02 · Specification</span><strong>기준규격, 시험법 및 안정성</strong><span>품질관리</span></div><div class="row"><span>03 · Safety</span><strong>안전성 및 섭취량 근거</strong><span>위해평가</span></div><div class="row"><span>04 · Function</span><strong>작용기전, 전임상 및 인체적용시험</strong><span>기능성 입증</span></div><div class="row"><span>05 · Submission</span><strong>기능성 내용과 신청자료 정합성 점검</strong><span>식약처 제출</span></div></div><h2>건강기능식품 연구원의 핵심 검토 질문</h2><div class="grid"><article class="card"><h3>개발 가능한 원료인가</h3><p>식용근거와 안전성, 제조 표준화, 기능성 차별성을 함께 검토해야 합니다.</p></article><article class="card"><h3>어떤 시험이 필요한가</h3><p>표적 기능성의 평가 가이드라인과 선행 인체적용시험을 기준으로 대상자와 평가변수를 설계합니다.</p></article><article class="card"><h3>자료 간 연결성이 있는가</h3><p>원료 특성, 지표성분, 작용기전, 섭취량과 최종 기능성 표현이 일관되어야 합니다.</p></article></div><h2>자주 묻는 질문</h2><div class="list"><details class="faq"><summary>개별인정원료 개발은 어디서 시작해야 하나요?</summary><p>원재료 기원과 식용근거, 제조공정, 안전성 자료의 보유 수준을 먼저 점검하고 목표 기능성과 기존 인정원료의 차별성을 검토합니다.</p></details><details class="faq"><summary>인체적용시험만 있으면 기능성 인정이 가능한가요?</summary><p>인체적용시험뿐 아니라 원료 표준화, 기준규격, 안전성, 작용기전과 시험 원료의 동질성이 함께 뒷받침되어야 합니다.</p></details><details class="faq"><summary>건강기능식품 원료 개발 기간은 얼마나 걸리나요?</summary><p>원료의 식용근거와 보유 자료, 독성시험 및 인체적용시험 필요 여부에 따라 달라지므로 사전 자료 격차 분석이 필요합니다.</p></details></div><p class="notice">본 페이지는 개발 흐름을 설명하는 일반 정보입니다. 실제 제출자료는 최신 식약처 고시·가이드라인과 원료별 특성을 기준으로 확인해야 합니다.</p><div class="cta"><a class="button" href="../#precheck">원료 Pre-Check 시작</a><a class="button secondary" href="../insights/">개발 브리프 보기</a></div>'''
    guide_schema={"@context":"https://schema.org","@graph":[{"@type":"Article","headline":"건강기능식품 원료 개발과 개별인정원료 연구 실무","description":guide_desc,"inLanguage":"ko-KR","mainEntityOfPage":f"{BASE}/ingredient-development/","publisher":{"@type":"Organization","name":"HealthArchive","url":f"{BASE}/"}},{"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"개별인정원료 개발은 어디서 시작해야 하나요?","acceptedAnswer":{"@type":"Answer","text":"원재료 기원과 식용근거, 제조공정, 안전성 자료의 보유 수준을 먼저 점검하고 목표 기능성과 기존 인정원료의 차별성을 검토합니다."}},{"@type":"Question","name":"인체적용시험만 있으면 기능성 인정이 가능한가요?","acceptedAnswer":{"@type":"Answer","text":"인체적용시험뿐 아니라 원료 표준화, 기준규격, 안전성, 작용기전과 시험 원료의 동질성이 함께 뒷받침되어야 합니다."}},{"@type":"Question","name":"건강기능식품 원료 개발 기간은 얼마나 걸리나요?","acceptedAnswer":{"@type":"Answer","text":"원료의 식용근거와 보유 자료, 독성시험 및 인체적용시험 필요 여부에 따라 달라지므로 사전 자료 격차 분석이 필요합니다."}}]}]}
    (GUIDE/'index.html').write_text(page('건강기능식품 원료 개발·개별인정원료 연구 실무 | HealthArchive',guide_desc,f'{BASE}/ingredient-development/',guide_body,'../',guide_schema),encoding='utf-8')
    paths=[('/', 'daily','1.0'),('/ingredient-development/','monthly','0.9'),('/insights/','weekly','0.9'),(f'/insights/weekly/{slug}.html','weekly','0.8'),('/en/','monthly','0.8')]
    entries=''.join(f'  <url>\n    <loc>{BASE}{p}</loc>\n    <lastmod>{date.today()}</lastmod>\n    <changefreq>{freq}</changefreq>\n    <priority>{priority}</priority>\n  </url>\n' for p,freq,priority in paths)
    (ROOT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+entries+'</urlset>\n',encoding='utf-8')
if __name__=='__main__':generate()
