# -*- coding: utf-8 -*-
"""
PubMed / Europe PMC에서 전일(어제) 등재된 논문 중 임상시험(clinical trial) 또는
동물 경구투여(in vivo, oral administration) 실험이면서 천연물·유산균·천연물 유래
정제물 키워드를 포함하는 논문을 찾아, 규칙 기반으로 핵심 정보(실험설계·섭취량·
섭취기간·모델/대상자·바이오마커·유의적 결과)를 추출해 1페이지 표 형식 PDF
리포트를 생성한다.

주의: 외부 LLM API를 호출하지 않는 규칙(정규식/키워드) 기반 추출이므로, 초록에
명시되지 않은 정보는 추출되지 않을 수 있다. 표의 각 셀은 항상 "-"로 표시해
추출 실패를 숨기지 않으며, 원문 PubMed 링크를 항상 포함해 직접 검증할 수 있게 한다.

Windows 작업 스케줄러에 등록해서 매일 아침 9시에 자동 실행한다.
"""
import json
import os
import re
import sys
import io
import tarfile
import time
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from _status import touch

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(BASE_DIR, 'paper-reports')
SOURCE_PDF_DIR = os.path.join(BASE_DIR, 'paper-source-pdfs')
DATA_FILE = os.path.join(BASE_DIR, 'data', 'paper_reports.json')
JS_FILE = os.path.join(BASE_DIR, 'data', 'paper_reports.js')
LOG_FILE = os.path.join(BASE_DIR, 'scripts', 'update_log.txt')
FONT_PATH = r"C:\Windows\Fonts\malgun.ttf"
FONT_BOLD_PATH = r"C:\Windows\Fonts\malgunbd.ttf"

ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
EPMC_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"

HEADERS = {"User-Agent": "HealthArchiveBot/1.0 (personal research archive)"}

MAX_NEW_PER_RUN = 30

# 천연물 / 유산균 / 천연물 유래 정제물 키워드 (영문 검색이므로 영문 위주로 구성).
# PubMed 쿼리 빌드와 본문 내 매칭 키워드 표시(analyze())에 동일한 리스트를 공유해서
# "쿼리에는 걸렸는데 매칭 키워드가 안 잡혀 버려지는" 불일치가 없도록 한다.
# 'extract'는 의도적으로 포함 — "OO extract" 식으로 쓰이는 임의의 천연물
# 추출물(예: ginseng extract, mulberry leaf extract 등)을 폭넓게 잡기 위함이며,
# 실제 어떤 추출물인지는 extract_named_extracts()로 별도 추출해 표시한다.
SUBSTANCE_KEYWORDS = [
    'extract',
    # 일반 천연물/추출물 표현
    'natural extract', 'herbal extract', 'plant extract', 'botanical extract', 'fruit extract',
    'leaf extract', 'root extract', 'seed extract', 'algae extract', 'marine extract',
    'phytochemical', 'natural compound', 'plant-derived', 'isolated compound', 'purified compound',
    'purified extract', 'bioactive compound', 'herbal medicine', 'traditional medicine',
    'dietary supplement', 'nutraceutical', 'functional food',
    # 천연물 유래 성분 카테고리
    'polyphenol', 'flavonoid', 'anthocyanin', 'isoflavone', 'terpenoid', 'saponin', 'alkaloid',
    'carotenoid', 'lutein', 'zeaxanthin', 'lycopene', 'tannin', 'lignan',
    # 대표 원료/소재명 (건강기능식품에서 흔히 쓰이는 천연물)
    'ginseng', 'curcumin', 'turmeric', 'green tea', 'EGCG', 'catechin', 'resveratrol',
    'quercetin', 'ginger', 'garlic', 'soy isoflavone', 'omega-3', 'fish oil', 'collagen',
    'chlorella', 'spirulina', 'propolis', 'royal jelly', 'milk thistle', 'silymarin',
    'ganoderma', 'cordyceps', 'schisandra', 'astragalus', 'rhodiola', 'ashwagandha',
    'centella asiatica', 'ginkgo', 'glucosamine', 'chondroitin', 'hyaluronic acid',
    'beta-glucan', 'chitosan', 'blueberry', 'bilberry', 'cranberry', 'pomegranate',
    'mulberry', 'red ginseng', 'black ginseng', 'licorice', 'mugwort', 'lotus',
    # 유산균/프로바이오틱스
    'probiotic', 'probiotics', 'synbiotic', 'prebiotic', 'lactic acid bacteria',
    'lactobacillus', 'bifidobacterium', 'lactiplantibacillus', 'limosilactobacillus',
    'levilactobacillus', 'lacticaseibacillus', 'akkermansia', 'saccharomyces boulardii',
]


def _tiab_term(term):
    return f'"{term}"[tiab]' if ' ' in term or '-' in term else f'{term}[tiab]'


SUBSTANCE_TERMS = ' OR '.join(_tiab_term(t) for t in SUBSTANCE_KEYWORDS)

# 사람 임상시험
CLINICAL_FILTER = '"clinical trial"[pt] OR "randomized controlled trial"[pt] OR "controlled clinical trial"[pt]'

# 동물 경구투여 실험
INVIVO_FILTER = (
    '"animals"[mesh] AND ("oral administration"[tiab] OR "orally administered"[tiab] OR '
    '"orally administrated"[tiab] OR gavage[tiab] OR "oral gavage"[tiab] OR "oral dose"[tiab] OR '
    '"oral supplementation"[tiab])'
)

PUBMED_QUERY = f'({SUBSTANCE_TERMS}) AND (({CLINICAL_FILTER}) OR ({INVIVO_FILTER}))'

BIOMARKER_KEYWORDS = [
    'HbA1c', 'glucose', 'insulin', 'HOMA-IR', 'LDL', 'HDL', 'triglyceride', 'cholesterol',
    'CRP', 'C-reactive protein', 'IL-6', 'IL-1β', 'TNF-α', 'TNF-alpha', 'cortisol', 'BDNF',
    'MDA', 'malondialdehyde', 'SOD', 'superoxide dismutase', 'GSH', 'glutathione', 'catalase',
    'ALT', 'AST', 'creatinine', 'BUN', 'blood pressure', 'systolic', 'diastolic',
    'body weight', 'body fat', 'BMI', 'waist circumference', 'bone mineral density',
    'fecal microbiota', 'gut microbiota', 'short-chain fatty acid', 'SCFA',
    'serotonin', 'dopamine', 'melatonin', 'sleep quality', 'PSQI', 'cognitive function',
    'MMSE', 'memory', 'fatigue', 'VAS', 'quality of life', 'antioxidant capacity',
    'testosterone', 'DHEAS', 'LH', 'FSH',
]

DESIGN_KEYWORDS = [
    'randomized', 'randomised', 'double-blind', 'double blind', 'single-blind', 'single blind',
    'placebo-controlled', 'placebo controlled', 'crossover', 'cross-over', 'parallel-group',
    'parallel group', 'open-label', 'open label', 'pilot study', 'in vitro',
]

MODEL_KEYWORDS = [
    'Sprague-Dawley', 'Sprague Dawley', 'C57BL/6', 'BALB/c', 'Wistar', 'ICR mice', 'db/db',
    'zebrafish', 'healthy adults', 'healthy volunteers', 'postmenopausal', 'overweight',
    'obese', 'elderly', 'children', 'patients with',
]

ROUTE_KEYWORDS = [
    'oral gavage', 'gavage', 'orally administered', 'drinking water', 'dietary supplementation',
    'intragastric', 'capsule', 'tablet', 'orally',
]


def log(msg):
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] {msg}"
    try:
        print(line)
    except UnicodeEncodeError:
        pass
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(line + '\n')


def http_get(url, params, headers=None):
    qs = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{url}?{qs}", headers=headers or HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def http_get_url(url, headers=None):
    req = urllib.request.Request(url, headers=headers or HEADERS)
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read()


def esearch_pubmed(term, mindate, maxdate, retmax=50):
    raw = http_get(ESEARCH_URL, {
        'db': 'pubmed', 'retmode': 'json', 'retmax': str(retmax),
        'datetype': 'edat', 'mindate': mindate, 'maxdate': maxdate, 'term': term,
    })
    data = json.loads(raw.decode('utf-8'))
    return data.get('esearchresult', {}).get('idlist', [])


def efetch_pubmed(pmids):
    if not pmids:
        return []
    raw = http_get(EFETCH_URL, {
        'db': 'pubmed', 'retmode': 'xml', 'id': ','.join(pmids),
    })
    root = ET.fromstring(raw)
    results = []
    for article in root.findall('.//PubmedArticle'):
        results.append(parse_pubmed_article(article))
    return results


def text_of(el):
    return ''.join(el.itertext()).strip() if el is not None else ''


def parse_pubmed_article(article):
    pmid = text_of(article.find('.//PMID'))
    title = text_of(article.find('.//ArticleTitle'))
    journal = text_of(article.find('.//Journal/ISOAbbreviation')) or text_of(article.find('.//Journal/Title'))
    year = text_of(article.find('.//JournalIssue/PubDate/Year')) or text_of(article.find('.//PubDate/MedlineDate'))[:4]
    volume = text_of(article.find('.//JournalIssue/Volume'))
    issue = text_of(article.find('.//JournalIssue/Issue'))
    pages = text_of(article.find('.//Pagination/MedlinePgn'))

    abstract_parts = []
    for ab in article.findall('.//Abstract/AbstractText'):
        label = ab.get('Label')
        t = text_of(ab)
        abstract_parts.append(f"[{label}] {t}" if label else t)
    abstract = '\n'.join(abstract_parts)

    doi = ''
    for eid in article.findall('.//ELocationID'):
        if eid.get('EIdType') == 'doi':
            doi = text_of(eid)

    pub_types = [text_of(pt) for pt in article.findall('.//PublicationType')]
    mesh_terms = [text_of(mh) for mh in article.findall('.//MeshHeading/DescriptorName')]

    is_clinical = any('clinical trial' in pt.lower() or 'randomized controlled trial' in pt.lower() for pt in pub_types)
    is_animal = any(m.lower() == 'animals' for m in mesh_terms)
    study_type = 'clinical' if is_clinical else ('invivo' if is_animal else 'unknown')

    authors = []
    for au in article.findall('.//Author'):
        last = text_of(au.find('LastName'))
        initials = text_of(au.find('Initials'))
        if last:
            authors.append(f"{last} {initials}".strip())

    return {
        'source': 'pubmed',
        'pmid': pmid,
        'doi': doi,
        'title': title,
        'journal': journal,
        'year': year,
        'volume': volume,
        'issue': issue,
        'pages': pages,
        'authors': authors,
        'abstract': abstract,
        'studyType': study_type,
        'meshTerms': mesh_terms,
        'url': f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else '',
    }


def search_europepmc(target_date, query, page_size=30):
    q = f'({query}) AND (FIRST_PDATE:"{target_date}")'
    try:
        raw = http_get(EPMC_URL, {
            'query': q, 'format': 'json', 'pageSize': str(page_size), 'resultType': 'core',
        })
    except Exception as e:
        log(f"WARN: Europe PMC search failed: {e}")
        return []
    data = json.loads(raw.decode('utf-8'))
    out = []
    for r in data.get('resultList', {}).get('result', []):
        if r.get('source') == 'MED':
            continue  # 이미 PubMed 경로에서 같은 레코드를 다루므로 제외
        abstract = r.get('abstractText', '') or ''
        out.append({
            'source': 'europepmc',
            'pmid': r.get('pmid') or '',
            'doi': r.get('doi') or '',
            'title': r.get('title', '').strip(),
            'journal': r.get('journalTitle', '') or r.get('source', ''),
            'year': r.get('pubYear', ''),
            'volume': r.get('journalVolume', ''),
            'issue': r.get('issue', ''),
            'pages': r.get('pageInfo', ''),
            'authors': [a.strip() for a in (r.get('authorString') or '').split(',') if a.strip()],
            'abstract': abstract,
            'studyType': 'unknown',
            'meshTerms': [],
            'url': f"https://europepmc.org/article/{r.get('source')}/{r.get('id')}",
        })
    return out


def europepmc_lookup(record):
    terms = []
    if record.get('pmid'):
        terms.append(f'EXT_ID:{record.get("pmid")}')
    if record.get('doi'):
        terms.append(f'DOI:"{record.get("doi")}"')
    if not terms:
        return {}
    raw = http_get(EPMC_URL, {
        'query': ' OR '.join(terms),
        'format': 'json',
        'pageSize': '1',
        'resultType': 'core',
    })
    data = json.loads(raw.decode('utf-8'))
    results = data.get('resultList', {}).get('result', [])
    return results[0] if results else {}


def source_pdf_candidates(record):
    out = []
    doi = record.get('doi') or ''
    if doi.startswith('10.1371/journal.'):
        out.append((0, f'https://journals.plos.org/plosone/article/file?id={urllib.parse.quote(doi, safe="/.")}&type=printable'))
    elif doi.startswith('10.1155/'):
        parts = doi.split('/')
        if len(parts) >= 3:
            out.append((1, f'https://www.hindawi.com/journals/{parts[1]}/2026/{parts[2]}.pdf'))
            out.append((1, f'https://onlinelibrary.wiley.com/doi/pdfdirect/{doi}'))
    elif doi.startswith('10.1002/') or doi.startswith('10.1111/'):
        out.append((1, f'https://onlinelibrary.wiley.com/doi/pdfdirect/{doi}'))
        out.append((1, f'https://onlinelibrary.wiley.com/doi/pdf/{doi}'))
    try:
        epmc = europepmc_lookup(record)
    except Exception as e:
        log(f"WARN: source PDF lookup failed for {record.get('pmid') or record.get('doi')}: {e}")
        epmc = {}

    for item in epmc.get('fullTextUrlList', {}).get('fullTextUrl', []) or []:
        url = item.get('url') or ''
        style = (item.get('documentStyle') or '').lower()
        availability = (item.get('availability') or '').lower()
        if not url:
            continue
        if style == 'pdf' or 'pdf' in url.lower():
            # 우선순위: open/free PDF, 그 다음 일반 PDF.
            score = 0 if ('open' in availability or 'free' in availability) else 1
            out.append((score, url))

    pmcid = epmc.get('pmcid') or ''
    if pmcid:
        try:
            raw = http_get('https://www.ncbi.nlm.nih.gov/pmc/utils/oa/oa.fcgi', {'id': pmcid})
            root = ET.fromstring(raw)
            for link in root.findall('.//link'):
                href = link.get('href') or ''
                fmt = (link.get('format') or '').lower()
                if href and fmt == 'tgz':
                    out.append((0, href.replace('ftp://ftp.ncbi.nlm.nih.gov/', 'https://ftp.ncbi.nlm.nih.gov/')))
        except Exception as e:
            log(f"WARN: PMC OA package lookup failed for {pmcid}: {e}")
        out.append((0, f'https://www.ncbi.nlm.nih.gov/pmc/articles/{pmcid}/pdf/'))
        out.append((0, f'https://europepmc.org/articles/{pmcid}?pdf=render'))

    seen = set()
    urls = []
    for _, url in sorted(out, key=lambda x: x[0]):
        if url in seen:
            continue
        seen.add(url)
        urls.append(url)
    return urls


def extract_pdf_from_tgz(raw):
    try:
        with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as tar:
            members = [m for m in tar.getmembers() if m.isfile() and m.name.lower().endswith('.pdf')]
            if not members:
                return b''
            members.sort(key=lambda m: m.size, reverse=True)
            f = tar.extractfile(members[0])
            return f.read() if f else b''
    except Exception as e:
        log(f"WARN: source PDF package extraction failed: {e}")
        return b''


def source_pdf_filename(record):
    file_id = record.get('pmid') or re.sub(r'[^a-zA-Z0-9]', '_', record.get('doi') or str(time.time()))
    return f"{file_id}_source.pdf"


def ensure_source_pdf(record):
    os.makedirs(SOURCE_PDF_DIR, exist_ok=True)
    pdf_name = source_pdf_filename(record)
    pdf_path = os.path.join(SOURCE_PDF_DIR, pdf_name)
    if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 1024:
        with open(pdf_path, 'rb') as f:
            if f.read(5) == b'%PDF-':
                return pdf_name, ''

    for url in source_pdf_candidates(record):
        try:
            raw = http_get_url(url, headers={
                **HEADERS,
                'Accept': 'application/pdf,text/html;q=0.9,*/*;q=0.8',
            })
        except Exception as e:
            log(f"WARN: source PDF download failed ({url}): {e}")
            continue
        if not raw.startswith(b'%PDF-') and url.lower().endswith(('.tar.gz', '.tgz')):
            raw = extract_pdf_from_tgz(raw)
        if not raw.startswith(b'%PDF-'):
            log(f"WARN: source PDF candidate was not PDF ({url})")
            continue
        with open(pdf_path, 'wb') as f:
            f.write(raw)
        return pdf_name, url
    return '', ''


def extract_pdf_text(pdf_path):
    try:
        from pypdf import PdfReader
        reader = PdfReader(pdf_path)
        parts = []
        for page in reader.pages[:30]:
            parts.append(page.extract_text() or '')
        return '\n'.join(parts)
    except Exception as e:
        log(f"WARN: source PDF text extraction failed for {os.path.basename(pdf_path)}: {e}")
        return ''


def find_keywords(text, keywords):
    text_l = text.lower()
    return [k for k in keywords if k.lower() in text_l]


PERCENT_PATTERN = re.compile(r'[+-]?\d+(\.\d+)?\s?%')
FOLD_PATTERN = re.compile(r'\d+(\.\d+)?[\s-]?fold', re.IGNORECASE)
P_PATTERN = re.compile(r'p\s*[<=≤>]\s*0?\.\d+|p\s*[-\s]?value[s]?\s*[<=≤]\s*0?\.\d+', re.IGNORECASE)

# "OO extract" 형태로 쓰이는 구체적 천연물 추출물명을 잡아내기 위한 패턴.
# 최대 3단어(예: "Panax ginseng root extract"는 앞 2~3단어)까지 허용한다.
NAMED_EXTRACT_PATTERN = re.compile(
    r'\b((?:[A-Za-z][A-Za-z\-]*\s){0,2}[A-Za-z][A-Za-z\-]*\s+extract)\b', re.IGNORECASE)
GENERIC_EXTRACT_FIRSTWORDS = {'the', 'this', 'that', 'an', 'a', 'said', 'our', 'its', 'aqueous',
                               'crude', 'such', 'these', 'those'}

MECHANISM_KEYWORDS = [
    'mechanism', 'pathway', 'signaling', 'signalling', 'via the', 'through the',
    'by activating', 'by inhibiting', 'by suppressing', 'by promoting', 'by enhancing',
    'by modulating', 'by upregulating', 'by downregulating', 'upregulat', 'downregulat',
    'suppress', 'modulat', 'axis', 'expression of', 'activation of', 'inhibition of',
    'mediated by', 'associated with increased', 'associated with decreased',
]


def extract_named_extracts(text):
    """'ginseng extract' 같이 구체적인 천연물 추출물명을 추출한다."""
    out = []
    for m in NAMED_EXTRACT_PATTERN.finditer(text):
        phrase = m.group(1).strip()
        first_word = phrase.split(' ')[0].lower()
        if first_word in GENERIC_EXTRACT_FIRSTWORDS:
            continue
        out.append(phrase)
    return list(dict.fromkeys(out))[:5]


def extract_significant_findings(text):
    """p값이 명시된 문장을 찾아 결과로 추출한다 (군간/군내/전후 비교 모두 포함).

    각 문장에서 %·fold-change 수치도 함께 뽑아 "[변화량] 문장" 형태로 정리한다.
    """
    sentences = re.split(r'(?<=[.!?])\s+', text)
    findings = []
    for s in sentences:
        if not P_PATTERN.search(s):
            continue
        percents = [m.group(0).strip() for m in PERCENT_PATTERN.finditer(s)]
        folds = [m.group(0).strip() for m in FOLD_PATTERN.finditer(s)]
        tag = ', '.join(dict.fromkeys(percents + folds))
        findings.append({'sentence': s.strip(), 'changeTag': tag})
    return findings


def extract_mechanism(text):
    """작용 기전(경로·표적분자 등)을 언급한 문장을 추출한다."""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    keywords_l = [k.lower() for k in MECHANISM_KEYWORDS]
    out = []
    for s in sentences:
        sl = s.lower()
        if any(k in sl for k in keywords_l):
            out.append(s.strip())
    return out[:6]


def extract_dose(text):
    pattern = re.compile(
        r'\d+(\.\d+)?\s*(mg/kg(/day)?|g/kg(/day)?|mg(/day)?|g(/day)?|IU(/day)?|'
        r'×?\s?10\^?\d+\s?CFU|CFU(/day)?|mL(/kg)?)',
        re.IGNORECASE)
    matches = pattern.finditer(text)
    return list(dict.fromkeys(m.group(0) for m in matches))[:8]


def extract_duration(text):
    pattern = re.compile(r'\d+\s*(weeks?|wks?|days?|months?)', re.IGNORECASE)
    matches = pattern.finditer(text)
    return list(dict.fromkeys(m.group(0) for m in matches))[:6]


def extract_sample_info(text):
    pattern = re.compile(
        r'\b\d+\s*(participants?|subjects?|patients?|volunteers?|rats?|mice|mouse)\b',
        re.IGNORECASE)
    matches = pattern.finditer(text)
    samples = list(dict.fromkeys(m.group(0) for m in matches))[:4]
    group_n = list(dict.fromkeys(re.findall(r'\bn\s*=\s*\d+\b', text, re.IGNORECASE)))[:4]
    models = find_keywords(text, MODEL_KEYWORDS)
    return samples, group_n, models


def extract_eligibility(text):
    """선정기준(대상자 특성)을 사람이 읽을 수 있는 짧은 문구로 정리한다."""
    parts = []
    age_m = re.search(r'\b(\d{1,2})\s*[-–~]\s*(\d{1,2})\s*(years|y/o|yrs|year-old)', text, re.IGNORECASE)
    if age_m:
        parts.append(f"{age_m.group(1)}~{age_m.group(2)}세")
    else:
        single_age = re.search(r'aged\s*(\d{1,3})\b', text, re.IGNORECASE)
        if single_age:
            parts.append(f"{single_age.group(1)}세 전후")
    health_terms = find_keywords(text, [
        'healthy', 'postmenopausal', 'overweight', 'obese', 'elderly', 'pregnant',
    ])
    parts += health_terms
    cond_m = re.search(r'patients with ([a-zA-Z0-9\s\-]{3,40})', text, re.IGNORECASE)
    if cond_m:
        parts.append(f"patients with {cond_m.group(1).strip().rstrip(',. ')}")
    return ', '.join(dict.fromkeys(parts))


def extract_route(text):
    found = find_keywords(text, ROUTE_KEYWORDS)
    return ', '.join(dict.fromkeys(found)) if found else '경구(세부 방법 미특정)'


# 아래 키워드는 "투여한 시험물질"이 아니라 결과 섹션의 생체지표/조직 성분으로도
# 흔히 언급되어(예: 섬유화 연구의 "collagen IV 발현") 거짓 양성이 잦다. 이런
# 키워드가 매칭됐을 때는 투여/섭취 맥락 단어가 같은 문장에 있는지 추가로 확인한다.
AMBIGUOUS_SUBSTANCE_KEYWORDS = {'collagen', 'hyaluronic acid', 'lutein', 'zeaxanthin', 'lycopene'}

ADMIN_CONTEXT_KEYWORDS = [
    'administ', 'supplement', 'treated with', 'treatment with', 'gavage', 'fed ',
    'diet containing', 'diet supplemented', 'received', 'intake of', 'oral dose',
    'orally', 'capsule', 'daily dose', 'mg/kg', 'g/kg', 'mg/day', 'g/day', 'was given',
    'were given', 'consumption of', 'ingestion of',
]


def matched_substances_with_context(full_text, abstract):
    """SUBSTANCE_KEYWORDS 중 본문에 등장하는 것 + 구체적 'OO extract' 표현을 찾는다.
    단, 'extract'(범용어) 자체는 표시용으로 쓰지 않고 named-extract 표현으로
    대체하며, 생체지표로도 흔히 쓰이는 모호한 키워드는 투여/섭취 맥락이 같은
    문장에 있어야만 "시험물질"로 인정한다."""
    raw_matches = find_keywords(full_text, [k for k in SUBSTANCE_KEYWORDS if k != 'extract'])
    named_extracts = extract_named_extracts(full_text)

    sentences = re.split(r'(?<=[.!?])\s+', abstract)
    sentences_l = [s.lower() for s in sentences]

    def has_admin_context(term_l):
        return any(
            term_l in s and any(ctx in s for ctx in ADMIN_CONTEXT_KEYWORDS)
            for s in sentences_l
        )

    confirmed = []
    for term in raw_matches:
        if term.lower() in AMBIGUOUS_SUBSTANCE_KEYWORDS and not has_admin_context(term.lower()):
            continue
        confirmed.append(term)

    return list(dict.fromkeys(named_extracts + confirmed))


def analyze(record, source_text=''):
    abstract = record.get('abstract', '') or ''
    analysis_body = source_text.strip() or abstract
    full_text = f"{record.get('title', '')}\n{analysis_body}"
    matched_substances = matched_substances_with_context(full_text, abstract)
    design = find_keywords(full_text, DESIGN_KEYWORDS)
    if record.get('studyType') == 'clinical' and find_keywords(full_text, ['randomized', 'randomised']):
        design = list(dict.fromkeys(design + ['RCT']))
    samples, group_n, models = extract_sample_info(analysis_body)
    doses = extract_dose(analysis_body)
    durations = extract_duration(analysis_body)
    biomarkers = find_keywords(analysis_body, BIOMARKER_KEYWORDS)
    findings = extract_significant_findings(analysis_body)
    mechanisms = extract_mechanism(analysis_body)
    eligibility = extract_eligibility(analysis_body)
    route = extract_route(analysis_body)
    return {
        'matchedSubstances': matched_substances,
        'design': design,
        'sampleInfo': samples,
        'groupN': group_n,
        'models': models,
        'doses': doses,
        'durations': durations,
        'biomarkers': biomarkers,
        'significantFindings': findings,
        'mechanisms': mechanisms,
        'eligibility': eligibility,
        'route': route,
    }


def build_citation(record):
    authors = record.get('authors') or []
    first_author_last = authors[0].split(' ')[0] if authors else ''
    suffix = ' et al.' if len(authors) > 1 else ''
    journal = record.get('journal', '') or '-'
    year = record.get('year', '') or '-'
    vol = record.get('volume', '') or ''
    issue = record.get('issue', '') or ''
    pages = record.get('pages', '') or ''
    vol_issue = vol + (f"({issue})" if issue else '')
    cite = f"{first_author_last}{suffix} {journal}. {year}".strip()
    if vol_issue:
        cite += f";{vol_issue}"
    if pages:
        cite += f":{pages}"
    return (cite + '.').strip()


PDF_TEXT_REPLACEMENTS = str.maketrans({
    '\u00a0': ' ',
    '\u2007': ' ',
    '\u2009': ' ',
    '\u202f': ' ',
    '\u2070': '0',
    '\u00b9': '1',
    '\u00b2': '2',
    '\u00b3': '3',
    '\u2074': '4',
    '\u2075': '5',
    '\u2076': '6',
    '\u2077': '7',
    '\u2078': '8',
    '\u2079': '9',
})


def pdf_text(text):
    return str(text or '-').translate(PDF_TEXT_REPLACEMENTS)


def truncate(text, limit):
    text = pdf_text(text)
    return text if len(text) <= limit else text[:limit - 1].rstrip() + '…'


def join_or_dash(items, sep=', ', limit=None):
    vals = [str(x).strip() for x in (items or []) if str(x).strip()]
    text = sep.join(dict.fromkeys(vals)) if vals else '-'
    return truncate(text, limit) if limit else text


FUNCTION_DIRECTION_RULES = [
    ('인지기능·기억력 개선', ['cognitive', 'memory', 'mmse', 'moca', 'bdnf', 'hippocamp']),
    ('수면건강', ['sleep', 'psqi', 'melatonin', 'insomnia']),
    ('장 건강', ['gut microbiota', 'fecal microbiota', 'scfa', 'bowel', 'enteritis', 'diarrhea', 'constipation']),
    ('면역기능/면역과민반응', ['immune', 'allergy', 'ige', 'cytokine', 'il-6', 'tnf', 'inflammation']),
    ('간 건강', ['liver', 'alt', 'ast', 'hepatic', 'nafld', 'nash']),
    ('혈당 조절', ['glucose', 'insulin', 'homa-ir', 'hba1c', 'diabetes']),
    ('혈중 지질 개선', ['triglyceride', 'cholesterol', 'ldl', 'hdl', 'lipid']),
    ('체지방 감소', ['body fat', 'obesity', 'bmi', 'waist', 'adipose']),
    ('뼈·관절 건강', ['bone', 'joint', 'osteo', 'cartilage', 'arthritis']),
    ('피로 개선', ['fatigue', 'exercise performance', 'endurance']),
    ('남성/전립선 건강', ['testosterone', 'prostate', 'semen', 'fertility']),
    ('피부 건강', ['skin', 'collagen', 'tewl', 'wrinkle']),
    ('항산화', ['oxidative', 'antioxidant', 'sod', 'mda', 'gsh']),
]


def infer_functional_direction(record, analysis):
    text = ' '.join([
        record.get('title', ''),
        record.get('abstract', ''),
        ' '.join(analysis.get('biomarkers') or []),
        ' '.join(analysis.get('mechanisms') or []),
    ]).lower()
    for label, terms in FUNCTION_DIRECTION_RULES:
        if any(t in text for t in terms):
            return label
    return '기능성 방향 원문 검토 필요'


def report_grade(record, analysis):
    study_type = record.get('studyType', 'unknown')
    has_findings = bool(analysis.get('significantFindings'))
    has_dose = bool(analysis.get('doses'))
    if study_type == 'clinical' and has_findings:
        return 'B-', '조건부 검토', '인체적용시험과 유의 결과가 확인되나 초록 기반 자동 추출이므로 원문 수치·대상자·안전성 확인 필요'
    if study_type == 'clinical':
        return 'C+', '원문 확인', '인체적용시험이나 초록상 통계 결과 추출이 제한적이어서 원문 확인 후 판단 필요'
    if study_type == 'invivo' and has_findings and has_dose:
        return 'C+', '전임상 근거', '경구투여 동물시험과 유의 결과가 확인되나 인체적용시험 근거 보완 필요'
    if study_type == 'invivo':
        return 'C', '기전 보조자료', '전임상 자료로 활용 가능하나 투여량·결과값·기전의 원문 대조 필요'
    return 'C', '스크리닝', '자동 선별 후보로 연구유형과 기능성 관련성을 원문에서 재확인 필요'


def result_value_type(finding):
    tag = finding.get('changeTag') if isinstance(finding, dict) else ''
    return '변화량/비율형 결과값' if tag else '통계 유의성 결과값'


def first_sentence(text, limit=130):
    if not text:
        return '-'
    sentence = re.split(r'(?<=[.!?])\s+', text.strip())[0]
    return truncate(sentence, limit)


def make_report_title(primary_substance):
    return f"원료 개발검토 의견서 | {primary_substance}"


def google_scholar_url(record):
    query = record.get('doi') or record.get('title') or ''
    return 'https://scholar.google.com/scholar?q=' + urllib.parse.quote(query)


def make_pdf(record, analysis, out_path):
    from fpdf import FPDF
    from fpdf.fonts import FontFace

    pdf = FPDF()
    pdf.set_auto_page_break(True, margin=12)
    pdf.set_margins(12, 12, 12)
    pdf.add_page()
    pdf.add_font('Malgun', '', FONT_PATH)
    pdf.add_font('Malgun', 'B', FONT_BOLD_PATH)

    def mc(h, txt, size=9.5, bold=False, color=(30, 30, 30)):
        pdf.set_font('Malgun', 'B' if bold else '', size)
        pdf.set_text_color(*color)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, h, pdf_text(txt), new_x="LMARGIN", new_y="NEXT")

    def section(title):
        pdf.ln(2)
        mc(6.5, title, size=12, bold=True, color=(31, 111, 84))

    def table_rows(rows, col_widths, aligns=None, line_height=5.0, font_size=8.7):
        pdf.set_font('Malgun', '', font_size)
        aligns = aligns or tuple('LEFT' for _ in col_widths)
        with pdf.table(col_widths=col_widths, text_align=aligns, line_height=line_height) as table:
            label_style = FontFace(family='Malgun', emphasis='BOLD', fill_color=(232, 243, 238), size_pt=font_size)
            value_style = FontFace(family='Malgun', size_pt=font_size)
            head_style = FontFace(family='Malgun', emphasis='BOLD', fill_color=(246, 250, 247), size_pt=font_size)
            for ridx, values in enumerate(rows):
                row = table.row()
                for cidx, value in enumerate(values):
                    style = head_style if ridx == 0 else (label_style if cidx == 0 else value_style)
                    row.cell(pdf_text(value), style=style)

    study_type = record.get('studyType', 'unknown')
    type_label = {'clinical': '인체적용시험', 'invivo': '동물/전임상시험', 'unknown': '연구(분류 미확정)'}[study_type]
    design_tag = 'RCT' if 'RCT' in analysis['design'] else (
        'In Vivo' if study_type == 'invivo' else (analysis['design'][0] if analysis['design'] else '-'))
    primary_substance = analysis['matchedSubstances'][0] if analysis['matchedSubstances'] else '천연물/유산균'
    function_direction = infer_functional_direction(record, analysis)
    grade, grade_label, grade_note = report_grade(record, analysis)
    citation = build_citation(record)

    mc(8, make_report_title(primary_substance), size=15, bold=True, color=(31, 111, 84))
    mc(5.2, f"HealthArchive Daily Screening / PubMed 검색 기준 {datetime.now().strftime('%Y.%m.%d')} KST", size=8.8, color=(95, 103, 99))
    pdf.ln(1)

    table_rows([
        ('검토일', '검토 대상', '기능성 방향', '판정'),
        (datetime.now().strftime('%Y.%m.%d'), truncate(primary_substance, 34), function_direction, f"{grade}\n{grade_label}"),
        ('핵심 결론', truncate(grade_note, 92), '', ''),
    ], (24, 62, 49, 35), line_height=5.0, font_size=8.4)

    section('1. 원료 과학 분석')
    table_rows([
        ('항목', '현재 확인', '허가 관점 해석'),
        ('원료 정체성', join_or_dash(analysis['matchedSubstances'], ', ', 80), '원재료 기원, 제조공정, 지표성분 규격 및 동등성 자료 확인 필요'),
        ('핵심 성분/지표', join_or_dash(analysis['biomarkers'], ', ', 90), '기능성분 또는 평가지표 후보. 정량법 validation 및 반복 로트 자료 필요'),
        ('기전 가설', join_or_dash(analysis['mechanisms'][:3], ' / ', 110), '가이드 기능성 방향과 연결되는 biomarker/전임상 보조자료로 설득력 보완'),
        ('안전성 쟁점', '초록 기반 이상반응·독성 상세 추출 제한', '일일섭취량, 90일 반복투여독성, 유전독성, 병용/취약군 안전성 검토 필요'),
    ], (30, 70, 70), line_height=5.0, font_size=8.2)

    section('2. 기능성 결과')
    if study_type == 'clinical':
        result_rows = [
            ('구분', '항목', '결과값\n(유형 명시)', '통계/비고'),
            ('프로토콜', '디자인', truncate(join_or_dash(analysis['design'], ', ', 70), 70), type_label),
            ('프로토콜', '대상', truncate(join_or_dash(analysis['sampleInfo'] + analysis['groupN'], ', ', 80), 80), truncate(analysis['eligibility'] or '선정기준 원문 확인 필요', 70)),
            ('프로토콜', '섭취기간/시점', join_or_dash(analysis['durations'], ', ', 55), truncate('일일섭취량: ' + join_or_dash(analysis['doses'], ', ', 55), 70)),
        ]
    else:
        result_rows = [
            ('구분', '항목', '결과값\n(유형 명시)', '통계/비고'),
            ('프로토콜', '시험모델', truncate(join_or_dash(analysis['models'] + analysis['sampleInfo'], ', ', 80), 80), type_label),
            ('프로토콜', '투여방법', truncate(analysis['route'], 70), truncate('투여량: ' + join_or_dash(analysis['doses'], ', ', 60), 70)),
            ('프로토콜', '투여기간', join_or_dash(analysis['durations'], ', ', 55), truncate(join_or_dash(analysis['design'], ', ', 70), 70)),
        ]
    if analysis['significantFindings']:
        for f in analysis['significantFindings'][:6]:
            result_rows.append((
                '결과',
                truncate(join_or_dash(analysis['biomarkers'][:3], ', ', 42), 42),
                truncate(f.get('sentence'), 115),
                result_value_type(f),
            ))
    else:
        result_rows.append(('결과', '유의 결과', '초록에 p값이 명시된 문장이 없어 원문 확인 필요', '자동 추출 제한'))
    table_rows(result_rows, (23, 34, 78, 35), line_height=4.8, font_size=7.7)

    section('3. 동물/세포시험 및 기전 보완')
    if study_type == 'invivo':
        direct_status = '해당 원료 직접 전임상 자료'
        direct_content = f"{join_or_dash(analysis['models'] + analysis['sampleInfo'], ', ', 85)} / {join_or_dash(analysis['doses'], ', ', 65)}"
        direct_judgement = '전임상 유효성·기전 보조자료로 활용 가능'
    else:
        direct_status = '해당 논문 기준 전임상 자료'
        direct_content = '본 논문은 인체적용시험 중심으로 자동 분류됨'
        direct_judgement = '직접 동물/세포시험은 별도 문헌 확인 필요'
    table_rows([
        ('구분', '확인 결과', '주요 내용', '판정'),
        ('직접자료', direct_status, truncate(direct_content, 95), direct_judgement),
        ('기전자료', '초록 내 기전 문장 자동 추출', truncate(join_or_dash(analysis['mechanisms'][:4], ' / ', 115), 115), '기능성 biomarker와 연결성 검토 필요'),
        ('허가 관점', '보완 필요', '기능성별 평가가이드의 적합 모델, 주평가지표, 안전성 패키지와 대조 필요', '원문/full dossier 확인'),
    ], (24, 42, 74, 30), line_height=4.8, font_size=7.7)

    section('4. 검토대상 원재료 기반 효능 근거')
    table_rows([
        ('원재료', '형태·섭취량', '기능성/모델', '통계·주요결과', '해석'),
        (
            truncate(primary_substance, 28),
            truncate(f"{join_or_dash(analysis['doses'], ', ', 45)}\n{join_or_dash(analysis['durations'], ', ', 35)}", 60),
            truncate(function_direction + '\n' + join_or_dash(analysis['models'] + analysis['sampleInfo'], ', ', 45), 70),
            truncate(first_sentence(analysis['significantFindings'][0]['sentence'] if analysis['significantFindings'] else '', 90), 90),
            '후보 원료 관련 직접 논문. 반복성, 대상자 적합성, 원문 수치 확인 필요',
        ),
    ], (30, 32, 40, 45, 23), line_height=4.6, font_size=7.4)

    section('5. 허가 관점 평가')
    has_clinical = '확인' if study_type == 'clinical' else '미확인'
    has_preclinical = '확인' if study_type == 'invivo' else '별도 확인 필요'
    table_rows([
        ('평가', '판정', '근거', '보완 필요자료'),
        ('기능성', grade_label, f"{type_label}, {join_or_dash(analysis['biomarkers'][:4], ', ', 60)}", '기능성 표현, 대상자 기준, 주평가지표 원문 대조'),
        ('과학성', '중간' if analysis['significantFindings'] else '제한적', f"인체자료: {has_clinical} / 전임상: {has_preclinical}", '반복 인체시험, 기전 biomarker, 용량반응성'),
        ('표준화', '미흡', '초록상 원료 규격·지표성분 정보 제한', '원료 규격서, 지표성분 분석법, 3롯트 COA'),
        ('안전성', '미확인', '자동 추출 자료만으로 안전성 판단 불가', '독성시험, 이상반응, 혈액·간·신장 안전성, 섭취상 주의'),
        ('개발판단', grade_label, grade_note, '원문 PDF/full dossier 확보 후 재평가'),
    ], (24, 28, 68, 50), line_height=4.7, font_size=7.5)

    section('6. 원문 링크 / DOI / PMID')
    table_rows([
        ('구분', '출처'),
        ('후보 논문', f"PMID {record.get('pmid') or '-'} / DOI {record.get('doi') or '-'} / {record.get('url') or '-'}"),
        ('Google Scholar', google_scholar_url(record)),
        ('서지', citation),
    ], (30, 140), line_height=4.8, font_size=7.8)

    pdf.ln(2)
    mc(4.6, '* 본 리포트는 확보된 원문 PDF 및 PubMed metadata 기반 규칙형 자동 추출 결과입니다. 최종 개발판단 전 원문, full dossier, 기능성 평가가이드 대조가 필요합니다.',
       size=7.5, color=(135, 135, 135))

    pdf.output(out_path)


def main():
    os.makedirs(PDF_DIR, exist_ok=True)
    os.makedirs(SOURCE_PDF_DIR, exist_ok=True)

    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump([], f)
    with open(DATA_FILE, encoding='utf-8') as f:
        reports = json.load(f)

    known_keys = {(r.get('source'), r.get('pmid'), r.get('doi')) for r in reports}

    yesterday = datetime.now() - timedelta(days=1)
    mindate = maxdate = yesterday.strftime('%Y/%m/%d')
    target_date = yesterday.strftime('%Y-%m-%d')

    try:
        pmids = esearch_pubmed(PUBMED_QUERY, mindate, maxdate, retmax=MAX_NEW_PER_RUN)
    except Exception as e:
        log(f"ERROR: PubMed esearch failed: {e}")
        pmids = []
    log(f"PubMed esearch: {len(pmids)} candidate(s) for {target_date}")

    candidates = []
    for i in range(0, len(pmids), 10):
        batch = pmids[i:i + 10]
        try:
            candidates.extend(efetch_pubmed(batch))
        except Exception as e:
            log(f"WARN: efetch failed for batch {batch}: {e}")
        time.sleep(0.4)

    epmc_query = f'({SUBSTANCE_TERMS.replace("[tiab]", "")}) AND (CLINICAL_TRIAL OR PRE_PRINT)'
    try:
        candidates.extend(search_europepmc(target_date, epmc_query))
    except Exception as e:
        log(f"WARN: Europe PMC step failed: {e}")

    new_count = 0
    for rec in candidates:
        if new_count >= MAX_NEW_PER_RUN:
            break
        key = (rec.get('source'), rec.get('pmid'), rec.get('doi'))
        if key in known_keys:
            continue
        if not rec.get('abstract'):
            continue

        source_pdf_name, source_pdf_url = ensure_source_pdf(rec)
        if not source_pdf_name:
            log(f"SKIP: source PDF not available for {rec.get('pmid') or rec.get('doi') or rec.get('title','')[:40]}")
            continue
        source_text = extract_pdf_text(os.path.join(SOURCE_PDF_DIR, source_pdf_name))
        analysis = analyze(rec, source_text)
        if not analysis['matchedSubstances']:
            continue  # 쿼리에는 걸렸지만 실제로 키워드가 명시되지 않은 경우 제외

        file_id = rec.get('pmid') or re.sub(r'[^a-zA-Z0-9]', '_', rec.get('doi') or str(time.time()))
        pdf_name = f"{file_id}.pdf"
        pdf_path = os.path.join(PDF_DIR, pdf_name)
        try:
            make_pdf(rec, analysis, pdf_path)
        except Exception as e:
            log(f"WARN: PDF generation failed for {rec.get('title','')[:50]}: {e}")
            continue

        reports.append({
            'source': rec['source'],
            'pmid': rec.get('pmid', ''),
            'doi': rec.get('doi', ''),
            'title': rec.get('title', ''),
            'journal': rec.get('journal', ''),
            'year': rec.get('year', ''),
            'studyType': rec.get('studyType', 'unknown'),
            'matchedSubstances': analysis['matchedSubstances'],
            'biomarkers': analysis['biomarkers'],
            'url': rec.get('url', ''),
            'pdfFile': pdf_name,
            'sourcePdfFile': source_pdf_name,
            'sourcePdfUrl': source_pdf_url,
            'scholarUrl': google_scholar_url(rec),
            'collectedDate': datetime.now().strftime('%Y-%m-%d'),
        })
        known_keys.add(key)
        new_count += 1
        log(f"added paper report: {rec.get('title','')[:60]} ({rec['source']}, {rec.get('studyType')})")

    if new_count:
        reports.sort(key=lambda r: r.get('collectedDate', ''), reverse=True)
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(reports, f, ensure_ascii=False, indent=2)
        with open(JS_FILE, 'w', encoding='utf-8') as f:
            f.write('var PAPER_REPORTS_DATA = ')
            json.dump(reports, f, ensure_ascii=False)
            f.write(';\n')
        log(f"DONE: {new_count} new paper report(s) added. total={len(reports)}")
    else:
        log("DONE: no new matching papers found.")

    touch('papers', count=len(reports), new_count=new_count)


if __name__ == '__main__':
    main()
