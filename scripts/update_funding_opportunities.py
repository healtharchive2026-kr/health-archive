# -*- coding: utf-8 -*-
"""기업마당 공식 API에서 건강기능식품 관련 지원과제를 선별한다."""
import hashlib
import html
import io
import json
import os
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from itertools import zip_longest

from pypdf import PdfReader


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'funding_opportunities.json')
LOG_FILE = os.path.join(BASE_DIR, 'scripts', 'update_log.txt')
API_URL = 'https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do'
PDF_ENRICH_LIMIT = 40
PDF_MAX_BYTES = 15 * 1024 * 1024
PDF_MAX_PAGES = 35
ENRICHMENT_VERSION = 2

ENRICHMENT_FIELDS = (
    'supportAmountText', 'researchPeriodText', 'matchingFundRequirements',
    'technologyFeeText', 'applicationEndTime', 'locationRequirements',
    'officialDocumentCheckedAt', 'officialDocumentName',
    'officialDocumentTextAvailable', 'officialDocumentEnrichmentVersion', 'sourceEvidence',
)

KEYWORD_SCORES = {
    5: ['건강기능식품', '기능성 원료', '기능성원료', '개별인정형', '개별인정'],
    3: ['인체적용시험', '생리활성', '효능평가', '효능 평가', '바이오마커'],
    2: ['천연물', '특용작물', '약용작물', '그린바이오', '해양바이오', '산림생명자원',
        '식품산업', '식품소재', '식품원료', '농식품',
        '기능성식품', '고령친화식품', '맞춤형식품', '푸드테크', '제형', '표준화', '스케일업',
        '식약처', '기준규격', '안전성', '규제과학', '인증', '인허가'],
    1: ['시제품', '기술사업화', 'R&BD', '제품화'],
    -3: ['의료기기 전용', '의약품 전용', '화장품 전용'],
}

# 범용 지원어(인증, 시제품 등)만 일치하는 비식품 공고를 사전에 차단한다.
FOOD_TITLE_TERMS = (
    '건강기능식품', '기능성식품', '기능성 원료', '기능성원료', '개별인정',
    '식품', '농식품', '푸드', '음료', '발효', '영양', '프로바이오틱스', '유산균',
    '천연물', '특용작물', '약용작물', '농산물', '수산물', '축산물', '식용',
)

FOOD_CONTENT_TERMS = (
    '건강기능식품', '기능성식품', '기능성 원료', '기능성원료', '개별인정',
    '식품산업', '식품소재', '식품원료', '식품제조', '식품기업', '농식품',
    '푸드테크', '고령친화식품', '맞춤형식품', '프로바이오틱스', '유산균',
    '식이보충제', '특용작물', '약용작물', '식용 천연물',
)

NON_FOOD_TITLE_TERMS = (
    '반도체', '수소', '자동차', '전기차', '이차전지', '배터리', '모빌리티',
    '디스플레이', '철강', '조선', '방산', '항공', '우주', '로봇', '드론',
    '금속', '기계장비', '전자부품', '전력', '에너지', '태양광', '풍력',
    '섬유', '선박', '스마트공장',
)

SUPPORT_TYPES = {
    '연구개발(R&D)': ['연구개발', 'R&D', '기술개발'],
    '기술사업화(R&BD)': ['R&BD', '기술사업화', '사업화'],
    '시제품 제작': ['시제품', '제품화'],
    '시험·분석': ['시험분석', '시험·분석', '분석 지원'],
    '효능·안전성 평가': ['효능평가', '효능 평가', '안전성 평가'],
    '인체적용시험': ['인체적용시험'],
    '원료 표준화': ['원료 표준화', '표준화'],
    '개별인정 및 인증·인허가': ['개별인정', '인허가', '인증 지원'],
    '특허·지식재산권': ['특허', '지식재산'],
    '연구장비 공동활용': ['연구장비', '장비 공동활용'],
    '공정개선·스케일업': ['공정개선', '스케일업'],
    '수출·마케팅': ['수출', '마케팅'],
    '산학연 공동연구': ['산학연', '공동연구'],
    'R&D 과제기획': ['과제기획', 'R&D 기획'],
    '기술수요조사': ['기술수요조사', '수요조사'],
    '공모예고·사전안내': ['공모예고', '사전안내'],
    '사업설명회': ['사업설명회'],
}

REGION_MAP = {
    '서울': ('SEOUL', '서울특별시'), '경기': ('GYEONGGI', '경기도'),
    '충북': ('CHUNGCHEONG', '충청북도'), '충남': ('CHUNGCHEONG', '충청남도'), '세종': ('CHUNGCHEONG', '세종특별자치시'),
    '강원': ('GANGWON', '강원특별자치도'), '전북': ('JEOLLA', '전북특별자치도'), '전남': ('JEOLLA', '전라남도'),
    '경북': ('GYEONGSANG', '경상북도'), '경남': ('GYEONGSANG', '경상남도'), '제주': ('JEJU', '제주특별자치도'),
    '부산': ('OTHER_METRO', '부산광역시'), '대구': ('OTHER_METRO', '대구광역시'), '인천': ('OTHER_METRO', '인천광역시'),
    '광주': ('OTHER_METRO', '광주광역시'), '대전': ('OTHER_METRO', '대전광역시'), '울산': ('OTHER_METRO', '울산광역시'),
}

CENTRAL_MARKERS = ['부', '처', '청', '위원회', '농촌진흥청', '식품의약품안전처', '중소벤처기업부', '산업통상']


def log(message):
    line = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {message}"
    print(line)
    with open(LOG_FILE, 'a', encoding='utf-8') as file:
        file.write(line + '\n')


def text(value):
    cleaned = re.sub(r'<[^>]+>', ' ', str(value or ''))
    return re.sub(r'\s+', ' ', html.unescape(cleaned).replace('&nbsp;', ' ')).strip()


def structured_text(value):
    cleaned = re.sub(r'(?i)<(?:br\s*/?|/p|/div|/li)>', '\n', str(value or ''))
    cleaned = re.sub(r'<[^>]+>', ' ', cleaned)
    lines = [re.sub(r'\s+', ' ', html.unescape(line)).strip(' \t-ㆍ·※☞') for line in cleaned.splitlines()]
    return '\n'.join(line for line in lines if line)


def pick(item, *keys):
    for key in keys:
        if item.get(key) not in (None, ''):
            return item[key]
    return ''


def find_items(payload):
    if isinstance(payload, list):
        if payload and all(isinstance(row, dict) for row in payload):
            return payload
        for value in payload:
            found = find_items(value)
            if found:
                return found
    if isinstance(payload, dict):
        for key in ('item', 'items', 'resultList', 'jsonArray'):
            if key in payload:
                value = payload[key]
                return value if isinstance(value, list) else [value]
        for value in payload.values():
            found = find_items(value)
            if found:
                return found
    return []


def fetch_items(api_key):
    params = urllib.parse.urlencode({
        'crtfcKey': api_key,
        'dataType': 'json',
        'searchCnt': '0',
        'pageUnit': '2000',
        'pageIndex': '1',
    })
    last_error = None
    for attempt in range(1, 4):
        request = urllib.request.Request(
            f'{API_URL}?{params}',
            headers={'User-Agent': 'HealthArchive/1.0 (+https://www.healtharchive.kr)'},
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = json.loads(response.read().decode('utf-8'))
            return find_items(payload)
        except (OSError, TimeoutError) as error:
            last_error = error
            if attempt < 3:
                log(f'WARN (funding): API request failed; retrying ({attempt}/3).')
                time.sleep(attempt * 10)
    raise last_error


def score_relevance(content):
    matched = []
    score = 0
    lowered = content.lower()
    for points, keywords in KEYWORD_SCORES.items():
        for keyword in keywords:
            if keyword.lower() in lowered:
                score += points
                matched.append(keyword)
    matched = list(dict.fromkeys(matched))
    level = 'HIGH' if score >= 5 else 'MEDIUM' if score >= 3 else 'LOW' if score >= 1 else 'EXCLUDED'
    return score, level, matched


def food_domain_match(title, content):
    lowered_title = title.lower()
    lowered_content = content.lower()
    title_matches = [term for term in FOOD_TITLE_TERMS if term.lower() in lowered_title]
    content_matches = [term for term in FOOD_CONTENT_TERMS if term.lower() in lowered_content]
    excluded_matches = [term for term in NON_FOOD_TITLE_TERMS if term.lower() in lowered_title]
    allowed = bool(title_matches or content_matches)
    if excluded_matches and not title_matches:
        allowed = False
    return allowed, list(dict.fromkeys(title_matches + content_matches)), excluded_matches


def parse_period(value):
    dates = re.findall(r'(20\d{2})[.\-/]?(\d{2})[.\-/]?(\d{2})', str(value or ''))
    normalized = [f'{year}-{month}-{day}' for year, month, day in dates[:2]]
    return (normalized + ['', ''])[:2]


def extract_deadline_time(value):
    matches = re.findall(r'(?<!\d)([01]?\d|2[0-3])\s*(?::|시)\s*([0-5]\d)?', str(value or ''))
    if not matches:
        return ''
    hour, minute = matches[-1]
    return f'{int(hour):02d}:{int(minute or 0):02d}'


def labeled_value(content, labels, max_length=260):
    lines = [line.strip() for line in structured_text(content).splitlines() if line.strip()]
    for index, line in enumerate(lines):
        if not any(label in line for label in labels):
            continue
        value = re.sub(r'^.*?(?:' + '|'.join(map(re.escape, labels)) + r')\s*[:：]?\s*', '', line).strip()
        if len(value) < 3 and index + 1 < len(lines):
            value = lines[index + 1]
        if value:
            value = re.split(
                r'\s*(?:□|■)\s*|\s+(?:신청자격|접수기간|신청기간|신청방법|문의처)\s*[:：]',
                value,
                maxsplit=1,
            )[0].strip()
            return value[:min(max_length, 220)].strip()
    return ''


def sentence_value(content, required_words, max_length=260):
    chunks = re.split(r'[\n。]|(?<=[.!?])\s+', structured_text(content))
    for chunk in chunks:
        if all(word in chunk for word in required_words):
            return chunk.strip()[:max_length]
    return ''


def split_multi(value, urls=False):
    raw = str(value or '').strip()
    if not raw:
        return []
    parts = re.split(r'@(?=https?://)', raw) if urls else raw.split('@')
    return [text(part) for part in parts if text(part)]


def build_attachments(raw):
    attachments = []
    for name_key, url_key, default_type in (
        ('fileNm', 'flpthNm', 'OTHER'), ('printFileNm', 'printFlpthNm', 'NOTICE')
    ):
        names = split_multi(raw.get(name_key))
        urls = split_multi(raw.get(url_key), urls=True)
        for name, url in zip_longest(names, urls, fillvalue=''):
            if not url:
                continue
            label = name or '공식 첨부파일'
            lowered = label.lower()
            attachment_type = 'RFP' if any(word in lowered for word in ('rfp', '제안요청', '공고문')) else default_type
            attachments.append({'name': label, 'url': url, 'attachmentType': attachment_type})
    return attachments


def fetch_pdf_text(url):
    request = urllib.request.Request(
        url,
        headers={'User-Agent': 'HealthArchive/1.0 (+https://www.healtharchive.kr)'},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        data = response.read(PDF_MAX_BYTES + 1)
    if len(data) > PDF_MAX_BYTES or not data.startswith(b'%PDF'):
        return ''
    reader = PdfReader(io.BytesIO(data))
    pages = []
    for page in reader.pages[:PDF_MAX_PAGES]:
        pages.append(page.extract_text() or '')
    return '\n'.join(pages)[:250000]


def enrich_from_official_document(item, checked_at):
    candidates = [file for file in item.get('attachments', []) if file.get('attachmentType') in ('NOTICE', 'RFP')]
    item['officialDocumentCheckedAt'] = checked_at
    item['officialDocumentTextAvailable'] = False
    item['officialDocumentEnrichmentVersion'] = ENRICHMENT_VERSION
    for attachment in candidates[:2]:
        try:
            document = fetch_pdf_text(attachment.get('url', ''))
        except Exception as error:
            log(f'WARN (funding): official document read failed for {item.get("sourceId")}: {type(error).__name__}')
            continue
        if not document.strip():
            continue
        item['officialDocumentTextAvailable'] = True
        item['officialDocumentName'] = attachment.get('name', '')
        item['sourceEvidence'] = ['BIZINFO_API', 'OFFICIAL_DOCUMENT']
        item['supportAmountText'] = item.get('supportAmountText') or labeled_value(
            document, ('지원규모', '지원금액', '지원한도', '총사업비', '사업비', '지원내용')
        )
        item['researchPeriodText'] = item.get('researchPeriodText') or labeled_value(
            document, ('연구기간', '사업기간', '협약기간', '수행기간', '과제기간', '지원기간')
        )
        item['matchingFundRequirements'] = item.get('matchingFundRequirements') or labeled_value(
            document, ('기관부담금', '기업부담금', '민간부담금', '자부담', '자기부담금')
        )
        item['technologyFeeText'] = item.get('technologyFeeText') or labeled_value(
            document, ('기술료', '성과활용료')
        )
        item['locationRequirements'] = item.get('locationRequirements') or sentence_value(document, ('소재', '기업'))
        period_line = labeled_value(document, ('접수기간', '신청기간', '공고기간'))
        item['applicationEndTime'] = item.get('applicationEndTime') or extract_deadline_time(period_line)
        return True
    item.setdefault('sourceEvidence', ['BIZINFO_API'])
    return False


def region_info(content, agency):
    matched = []
    for keyword, pair in REGION_MAP.items():
        if keyword in content:
            matched.append(pair)
    matched = list(dict.fromkeys(matched))
    central = any(marker in agency for marker in CENTRAL_MARKERS)
    if central or not matched:
        return 'CENTRAL', '', ['전국']
    groups = {pair[0] for pair in matched}
    return 'REGIONAL', next(iter(groups)) if len(groups) == 1 else '', [pair[1] for pair in matched]


def normalize(raw):
    title = text(pick(raw, 'title', 'pblancNm'))
    summary_raw = pick(raw, 'description', 'bsnsSumryCn')
    summary = text(summary_raw)
    agency = text(pick(raw, 'author', 'jrsdInsttNm'))
    managing = text(pick(raw, 'excInsttNm', 'excInsttNm'))
    hashtags = text(pick(raw, 'hashTags', 'hashtags'))
    target = text(pick(raw, 'trgetNm', 'trgetNm'))
    application_method = text(raw.get('reqstMthPapersCn'))
    contact = text(raw.get('refrncNm'))
    application_url = text(raw.get('rceptEngnHmpgUrl'))
    support_large = text(pick(raw, 'lcategory', 'pldirSportRealmLclasCodeNm'))
    support_middle = text(raw.get('pldirSportRealmMlsfcCodeNm'))
    content = ' '.join([title, summary, agency, managing, hashtags, target])
    food_domain_allowed, food_keywords, _ = food_domain_match(title, content)
    if not food_domain_allowed:
        return None
    score, level, matched = score_relevance(content)
    if score <= 0 and food_keywords:
        score, level = 1, 'LOW'
    if score <= 0:
        return None
    funding_level, region_group, regions = region_info(content, agency)
    support_types = [name for name, keywords in SUPPORT_TYPES.items() if any(keyword.lower() in content.lower() for keyword in keywords)]
    application_period = text(pick(raw, 'reqstDt', 'reqstBeginEndDe'))
    start_date, end_date = parse_period(application_period)
    source_id = text(pick(raw, 'seq', 'pblancId'))
    source_url = text(pick(raw, 'link', 'pblancUrl'))
    announcement = text(pick(raw, 'pubDate', 'creatDt', 'creatPnttm'))[:10].replace('.', '-').replace('/', '-')
    structured_summary = structured_text(summary_raw)
    support_amount = labeled_value(structured_summary, ('지원규모', '지원금액', '지원한도', '총사업비', '사업비'))
    research_period = labeled_value(structured_summary, ('연구기간', '사업기간', '협약기간', '수행기간', '과제기간', '지원기간'))
    location_requirement = sentence_value(structured_summary, ('소재', '기업'))
    matching_fund = labeled_value(structured_summary, ('기관부담금', '기업부담금', '민간부담금', '자부담', '자기부담금'))
    technology_fee = labeled_value(structured_summary, ('기술료', '성과활용료'))
    attachments = build_attachments(raw)
    normalized = {
        'id': f'BIZINFO:{source_id or hashlib.sha256(source_url.encode()).hexdigest()[:16]}',
        'sourceId': source_id,
        'sourceName': 'BIZINFO',
        'sourceUrl': source_url,
        'title': title,
        'summary': summary,
        'fundingLevel': funding_level,
        'centralAgency': agency if funding_level == 'CENTRAL' else '',
        'managingAgency': managing or agency,
        'regionGroup': region_group,
        'regions': regions,
        'municipalities': [],
        'supportTypes': support_types or ['공고문 확인 필요'],
        'announcementType': 'ANNOUNCEMENT',
        'status': 'UNKNOWN',
        'announcementDate': announcement,
        'applicationStartDate': start_date,
        'applicationEndDate': end_date,
        'applicationEndTime': extract_deadline_time(application_period),
        'applicationPeriodText': application_period,
        'applicationMethodText': application_method,
        'applicationUrl': application_url,
        'contactText': contact,
        'supportCategoryLarge': support_large,
        'supportCategoryMiddle': support_middle,
        'supportAmountText': support_amount,
        'researchPeriodText': research_period,
        'eligibleOrganizations': target,
        'leadEligibility': target,
        'companyParticipationRequired': None,
        'locationRequirements': location_requirement,
        'matchingFundRequirements': matching_fund,
        'technologyFeeText': technology_fee,
        'viewCount': int(raw.get('inqireCo') or 0),
        'sourceUpdatedAt': text(raw.get('updtPnttm')),
        'sourceEvidence': ['BIZINFO_API'],
        'relevanceScore': score,
        'relevanceLevel': level,
        'matchedKeywords': matched,
        'foodDomainKeywords': food_keywords,
        'adminReviewStatus': 'APPROVED' if level == 'HIGH' else 'PENDING',
        'attachments': attachments,
    }
    return normalized


def load_existing():
    if not os.path.exists(DATA_FILE):
        return {'version': 1, 'items': [], 'sources': []}
    with open(DATA_FILE, encoding='utf-8') as file:
        return json.load(file)


def main():
    api_key = os.getenv('BIZINFO_API_KEY', '').strip()
    existing = load_existing()
    if not api_key:
        log('SKIP (funding): BIZINFO_API_KEY is not configured; existing protected data retained.')
        return
    raw_items = fetch_items(api_key)
    fetched_source_ids = {
        text(pick(raw, 'seq', 'pblancId')) for raw in raw_items
        if text(pick(raw, 'seq', 'pblancId'))
    }
    previous = {item.get('id'): item for item in existing.get('items', [])}
    now = datetime.now(timezone.utc).isoformat()
    items = []
    seen_ids = set()
    for raw in raw_items:
        item = normalize(raw)
        if not item:
            continue
        old = previous.get(item['id'], {})
        item['firstSeenAt'] = old.get('firstSeenAt', now)
        item['lastCheckedAt'] = now
        if (
            old.get('sourceUpdatedAt') == item.get('sourceUpdatedAt')
            and old.get('officialDocumentCheckedAt')
            and old.get('officialDocumentEnrichmentVersion') == ENRICHMENT_VERSION
        ):
            for field in ENRICHMENT_FIELDS:
                if field in old:
                    item[field] = old[field]
        manual = old.get('manualOverride')
        if isinstance(manual, dict):
            item.update(manual)
            item['manualOverride'] = manual
        items.append(item)
        seen_ids.add(item['id'])
    candidates = [item for item in items if item.get('attachments') and not item.get('officialDocumentCheckedAt')]
    candidates.sort(key=lambda item: (
        item.get('applicationEndDate') or '9999-12-31',
        -int(item.get('relevanceScore') or 0),
    ))
    enriched_count = 0
    for item in candidates[:PDF_ENRICH_LIMIT]:
        if enrich_from_official_document(item, now):
            enriched_count += 1
        time.sleep(0.08)
    for item in items:
        hash_payload = {key: value for key, value in item.items() if key not in ('contentHash', 'lastCheckedAt')}
        item['contentHash'] = hashlib.sha256(
            json.dumps(hash_payload, ensure_ascii=False, sort_keys=True).encode()
        ).hexdigest()
    # API 응답에서 사라진 과제도 동일한 식품 도메인 기준을 통과한 경우만 보존한다.
    items.extend(
        item for item_id, item in previous.items()
        if item_id and item_id not in seen_ids
        and (
            item.get('manualOverride')
            or (
                item.get('sourceId') not in fetched_source_ids
                and food_domain_match(
                    text(item.get('title')),
                    ' '.join(text(item.get(key)) for key in (
                        'title', 'summary', 'centralAgency', 'managingAgency', 'eligibleOrganizations'
                    )),
                )[0]
            )
        )
    )
    items.sort(key=lambda row: (row.get('applicationEndDate') or '9999', -int(row.get('relevanceScore') or 0)))
    payload = {
        'version': 1,
        'lastSuccessfulSync': now,
        'sources': [{
            'name': 'BIZINFO',
            'label': '기업마당 지원사업 공고 API·공식 공고문',
            'lastSuccessfulSync': now,
            'count': len(items),
            'officialDocumentCheckedCount': sum(1 for item in items if item.get('officialDocumentCheckedAt')),
        }],
        'items': items,
    }
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, 'w', encoding='utf-8') as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write('\n')
    log(
        f'DONE (funding): {len(items)} relevant item(s) from {len(raw_items)} announcement(s); '
        f'{enriched_count} official document(s) enriched.'
    )


if __name__ == '__main__':
    main()
