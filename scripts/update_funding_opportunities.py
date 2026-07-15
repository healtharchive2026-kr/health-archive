# -*- coding: utf-8 -*-
"""기업마당 공식 API에서 건강기능식품 관련 지원과제를 선별한다."""
import hashlib
import json
import os
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'funding_opportunities.json')
LOG_FILE = os.path.join(BASE_DIR, 'scripts', 'update_log.txt')
API_URL = 'https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do'

KEYWORD_SCORES = {
    5: ['건강기능식품', '기능성 원료', '기능성원료', '개별인정형', '개별인정'],
    3: ['인체적용시험', '생리활성', '효능평가', '효능 평가', '바이오마커'],
    2: ['천연물', '특용작물', '약용작물', '그린바이오', '해양바이오', '산림생명자원',
        '기능성식품', '고령친화식품', '맞춤형식품', '푸드테크', '제형', '표준화', '스케일업',
        '식약처', '기준규격', '안전성', '규제과학', '인증', '인허가'],
    1: ['시제품', '기술사업화', 'R&BD', '제품화'],
    -3: ['의료기기 전용', '의약품 전용', '화장품 전용'],
}

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
    return re.sub(r'<[^>]+>', ' ', str(value or '')).replace('&nbsp;', ' ').strip()


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
    request = urllib.request.Request(
        f'{API_URL}?{params}',
        headers={'User-Agent': 'HealthArchive/1.0 (+https://www.healtharchive.kr)'},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        payload = json.loads(response.read().decode('utf-8'))
    return find_items(payload)


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


def parse_period(value):
    dates = re.findall(r'(20\d{2})[.\-/]?(\d{2})[.\-/]?(\d{2})', str(value or ''))
    normalized = [f'{year}-{month}-{day}' for year, month, day in dates[:2]]
    return (normalized + ['', ''])[:2]


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
    summary = text(pick(raw, 'description', 'bsnsSumryCn'))
    agency = text(pick(raw, 'author', 'jrsdInsttNm'))
    managing = text(pick(raw, 'excInsttNm', 'excInsttNm'))
    hashtags = text(pick(raw, 'hashTags', 'hashtags'))
    target = text(pick(raw, 'trgetNm', 'trgetNm'))
    content = ' '.join([title, summary, agency, managing, hashtags, target])
    score, level, matched = score_relevance(content)
    if score <= 0:
        return None
    funding_level, region_group, regions = region_info(content, agency)
    support_types = [name for name, keywords in SUPPORT_TYPES.items() if any(keyword.lower() in content.lower() for keyword in keywords)]
    start_date, end_date = parse_period(pick(raw, 'reqstDt', 'reqstDt'))
    source_id = text(pick(raw, 'seq', 'pblancId'))
    source_url = text(pick(raw, 'link', 'pblancUrl'))
    announcement = text(pick(raw, 'pubDate', 'creatDt'))[:10].replace('.', '-').replace('/', '-')
    attachments = []
    for name_key, url_key, attachment_type in (
        ('fileNm', 'flpthNm', 'OTHER'), ('printFileNm', 'printFlpthNm', 'NOTICE')
    ):
        name, url = text(raw.get(name_key)), text(raw.get(url_key))
        if name and url:
            attachments.append({'name': name, 'url': url, 'attachmentType': attachment_type})
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
        'supportAmountText': '',
        'researchPeriodText': '',
        'eligibleOrganizations': target,
        'leadEligibility': target,
        'companyParticipationRequired': None,
        'locationRequirements': '',
        'matchingFundRequirements': '',
        'technologyFeeText': '',
        'relevanceScore': score,
        'relevanceLevel': level,
        'matchedKeywords': matched,
        'adminReviewStatus': 'APPROVED' if level == 'HIGH' else 'PENDING',
        'attachments': attachments,
    }
    normalized['contentHash'] = hashlib.sha256(json.dumps(normalized, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
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
        manual = old.get('manualOverride')
        if isinstance(manual, dict):
            item.update(manual)
            item['manualOverride'] = manual
        items.append(item)
        seen_ids.add(item['id'])
    # 원천 API의 조회 범위가 바뀌어도 기존 공고와 관리자 수정값은 삭제하지 않는다.
    items.extend(item for item_id, item in previous.items() if item_id and item_id not in seen_ids)
    items.sort(key=lambda row: (row.get('applicationEndDate') or '9999', -int(row.get('relevanceScore') or 0)))
    payload = {
        'version': 1,
        'lastSuccessfulSync': now,
        'sources': [{'name': 'BIZINFO', 'label': '기업마당 지원사업 공고 API', 'lastSuccessfulSync': now, 'count': len(items)}],
        'items': items,
    }
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, 'w', encoding='utf-8') as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write('\n')
    log(f'DONE (funding): {len(items)} relevant item(s) from {len(raw_items)} announcement(s).')


if __name__ == '__main__':
    main()
