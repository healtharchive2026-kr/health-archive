// 기능성별 임상/전임상 프로토콜 표시용 데이터
// GUIDELINE_FILES의 기능성 평가 가이드 목록을 기준으로 화면 데이터를 구성한다.
var BIOMARKER_PROTOCOL_DEFS = {
  '간 건강': { clinical: { model: '간 효소 수치가 경계역인 성인', primaryBiomarkers: ['ALT', 'AST', 'γ-GTP', 'ALP', '총 빌리루빈'], secondaryBiomarkers: ['지질대사 지표', '피로도 또는 삶의 질 설문'] }, preclinical: { cellModels: ['HepG2', 'Hepa1c1c7'], animalModels: ['고지방식이 또는 화학물질 유도 간손상 동물'], biomarkers: ['ALT', 'AST', 'MDA', 'SOD', 'GSH', '염증성 사이토카인'] } },
  '갱년기 남성건강': { clinical: { model: '중년 이상 남성', primaryBiomarkers: ['AMS', '총 테스토스테론', '유리 테스토스테론'], secondaryBiomarkers: ['IIEF', '피로도', '안전성 혈액검사'] }, preclinical: { cellModels: ['Leydig cell', '전립선 관련 세포'], animalModels: ['노화 또는 성호르몬 변화 동물'], biomarkers: ['테스토스테론', 'LH', 'FSH', '전립선 관련 지표'] } },
  '갱년기 여성건강': { clinical: { model: '갱년기 증상을 보이는 여성', primaryBiomarkers: ['Kupperman index', 'MENQOL', '안면홍조 빈도'], secondaryBiomarkers: ['FSH', 'Estradiol', '수면 및 기분 설문'] }, preclinical: { cellModels: ['MCF-7', '조골세포'], animalModels: ['난소절제 동물'], biomarkers: ['Estradiol', 'FSH', '골밀도', '자궁중량'] } },
  '구취': { clinical: { model: '구취가 있는 성인', primaryBiomarkers: ['VSC', 'H2S', 'CH3SH', '관능검사 점수'], secondaryBiomarkers: ['설태 지수', '구강 미생물'] }, preclinical: { cellModels: ['구강 상피세포', '구강 혐기성 세균 배양'], animalModels: ['구강 미생물 조절 모델'], biomarkers: ['VSC 생성량', '세균 부착', '염증성 사이토카인'] } },
  '근력 및 근기능': { clinical: { model: '근기능 저하 또는 운동 중재 대상 성인', primaryBiomarkers: ['악력', '등속성 근력', '근지구력', '보행속도'], secondaryBiomarkers: ['근육량', 'CK', 'LDH', '피로도'] }, preclinical: { cellModels: ['C2C12 myotube'], animalModels: ['노화, 비사용성 근위축 또는 운동부하 동물'], biomarkers: ['근섬유 단면적', 'MyoD', 'myogenin', 'MuRF1', 'Atrogin-1'] } },
  '기관·기관지 건강 (기침·가래)': { clinical: { model: '기침, 가래, 기관지 불편감을 보이는 성인', primaryBiomarkers: ['기침 빈도', '가래 점수', 'CAT 또는 호흡기 증상 설문'], secondaryBiomarkers: ['폐기능', '염증성 사이토카인', '삶의 질'] }, preclinical: { cellModels: ['기관지 상피세포', '대식세포'], animalModels: ['흡연, 미세먼지 또는 염증 유도 호흡기 동물'], biomarkers: ['기관지 염증', '점액분비', 'IL-6', 'TNF-α', 'MUC5AC'] } },
  '긴장완화': { clinical: { model: '스트레스 또는 긴장감을 호소하는 성인', primaryBiomarkers: ['PSS', 'STAI', '코르티솔'], secondaryBiomarkers: ['심박변이도', '수면 설문', '기분척도'] }, preclinical: { cellModels: ['신경세포', 'HPA axis 관련 세포'], animalModels: ['구속 스트레스 또는 만성 스트레스 동물'], biomarkers: ['코르티코스테론', '도파민', '세로토닌', 'BDNF'] } },
  '눈 건강': { clinical: { model: '눈 피로 또는 시기능 저하를 호소하는 성인', primaryBiomarkers: ['눈 피로도', '눈물막 파괴시간', '황반색소밀도'], secondaryBiomarkers: ['시력', '대비감도', '안구건조 설문'] }, preclinical: { cellModels: ['망막색소상피세포', '광수용체 세포'], animalModels: ['광손상 또는 산화스트레스 유도 눈 건강 동물'], biomarkers: ['망막두께', '로돕신', 'MDA', 'SOD'] } },
  '다리 불편감(부기) 관련': { clinical: { model: '다리 부기 또는 불편감을 호소하는 성인', primaryBiomarkers: ['하지 둘레', '부종 점수', '다리 불편감 VAS'], secondaryBiomarkers: ['혈류 지표', '삶의 질', '염증 지표'] }, preclinical: { cellModels: ['혈관내피세포'], animalModels: ['정맥울혈 또는 부종 유도 동물'], biomarkers: ['혈관투과성', 'NO', 'eNOS', '염증성 사이토카인'] } },
  '면역과민반응': { clinical: { model: '알레르기 또는 면역과민 증상을 보이는 성인', primaryBiomarkers: ['증상 점수', 'IgE', '호산구'], secondaryBiomarkers: ['IL-4', 'IL-5', 'IL-13', '삶의 질 설문'] }, preclinical: { cellModels: ['비만세포', 'Th2 분화 모델'], animalModels: ['OVA 또는 알레르겐 유도 과민반응 동물'], biomarkers: ['IgE', 'histamine', 'Th1/Th2 cytokine', '호산구 침윤'] } },
  '면역기능': { clinical: { model: '면역기능 유지가 필요한 성인', primaryBiomarkers: ['NK cell activity', '림프구 아형', 'IgA'], secondaryBiomarkers: ['감기 발생일수', 'IL-2', 'IFN-γ', 'CRP'] }, preclinical: { cellModels: ['PBMC', '대식세포', 'NK cell'], animalModels: ['면역저하 또는 항원감작 동물'], biomarkers: ['NK 활성', 'NO', 'IgA', 'IL-2', 'IFN-γ'] } },
  '모발 건강': { clinical: { model: '모발 밀도 또는 굵기 저하를 보이는 성인', primaryBiomarkers: ['모발 밀도', '모발 굵기', '성장기 모발 비율'], secondaryBiomarkers: ['두피 상태', '탈락 모발 수', '자가평가'] }, preclinical: { cellModels: ['모유두세포', '각질형성세포'], animalModels: ['제모 또는 모주기 조절 동물'], biomarkers: ['VEGF', 'IGF-1', 'β-catenin', '모낭 성장기 전환'] } },
  '배뇨 건강': { clinical: { model: '빈뇨, 야간뇨 등 배뇨 불편감을 보이는 성인', primaryBiomarkers: ['IPSS', '배뇨일지', '야간뇨 횟수'], secondaryBiomarkers: ['잔뇨량', '최대요속', '삶의 질 점수'] }, preclinical: { cellModels: ['방광 평활근세포', '전립선 세포'], animalModels: ['과민성 방광 또는 전립선비대 동물'], biomarkers: ['방광수축', '염증 지표', 'DHT', '전립선 무게'] } },
  '뼈·관절 건강': { clinical: { model: '관절 불편감 또는 골건강 관리가 필요한 성인', primaryBiomarkers: ['관절 통증 VAS', 'WOMAC', '골밀도'], secondaryBiomarkers: ['CTX', 'osteocalcin', 'CRP', '삶의 질'] }, preclinical: { cellModels: ['연골세포', '조골세포', '파골세포'], animalModels: ['골관절염, 난소절제 또는 염증성 관절 동물'], biomarkers: ['MMP-13', 'COL2A1', 'ALP', 'TRAP', '골밀도'] } },
  '수면건강': { clinical: { model: '수면의 질 저하를 호소하는 성인', primaryBiomarkers: ['PSQI', '총 수면시간', '수면 효율'], secondaryBiomarkers: ['입면잠복기', '각성 횟수', '멜라토닌', '주간졸림'] }, preclinical: { cellModels: ['신경세포', 'GABA 수용체 평가계'], animalModels: ['수면장애 또는 스트레스 유도 동물'], biomarkers: ['GABA', '세로토닌', '멜라토닌', '수면 단계'] } },
  '요로 건강': { clinical: { model: '요로 불편감 또는 반복적 요로 건강 관리 대상자', primaryBiomarkers: ['요로 증상 점수', '소변 백혈구', '세균 부착 지표'], secondaryBiomarkers: ['재발 빈도', '소변 pH', '삶의 질'] }, preclinical: { cellModels: ['요로상피세포', 'E. coli 부착 모델'], animalModels: ['요로감염 유도 동물'], biomarkers: ['세균 부착', '소변 세균수', '염증성 사이토카인'] } },
  '운동수행능력': { clinical: { model: '운동 수행능력 평가가 가능한 성인', primaryBiomarkers: ['VO2max', '운동 지속시간', '최대파워'], secondaryBiomarkers: ['혈중 젖산', 'RPE', 'CK', '피로도'] }, preclinical: { cellModels: ['C2C12 myotube', '미토콘드리아 기능 평가계'], animalModels: ['강제수영 또는 트레드밀 운동 동물'], biomarkers: ['글리코겐', '젖산', 'AMPK', 'PGC-1α', '미토콘드리아 효소'] } },
  '월경전 불편감 개선': { clinical: { model: '월경전 불편감을 호소하는 여성', primaryBiomarkers: ['MDQ', 'DRSP', '복부통증 VAS'], secondaryBiomarkers: ['기분 증상', '삶의 질', '염증 지표'] }, preclinical: { cellModels: ['자궁 관련 세포', '염증 반응 세포'], animalModels: ['호르몬 조절 또는 통증 유도 동물'], biomarkers: ['prostaglandin', 'COX-2', '염증성 사이토카인'] } },
  '위 건강': { clinical: { model: '위 불편감 또는 소화기 증상을 호소하는 성인', primaryBiomarkers: ['위장관 증상 점수', '상복부 불편감 VAS', '소화불량 지수'], secondaryBiomarkers: ['H. pylori 관련 지표', '삶의 질', '염증 지표'] }, preclinical: { cellModels: ['위상피세포', 'H. pylori 감염 모델'], animalModels: ['에탄올, NSAID 또는 스트레스 유도 위손상 동물'], biomarkers: ['위점막 손상면적', 'PGE2', 'MUC5AC', '염증성 사이토카인'] } },
  '인지기능·기억력 개선': { clinical: { model: '인지기능 또는 기억력 평가가 필요한 성인', primaryBiomarkers: ['인지기능 검사', '기억력 검사', '주의력 검사'], secondaryBiomarkers: ['BDNF', '뇌파', '기분 및 수면 설문'] }, preclinical: { cellModels: ['신경세포', '미세아교세포'], animalModels: ['노화, scopolamine 또는 Aβ 유도 기억력 저하 동물'], biomarkers: ['AChE', 'BDNF', 'Aβ', '산화스트레스', '염증성 사이토카인'] } },
  '잇몸 건강': { clinical: { model: '치은염 또는 잇몸 불편감을 보이는 성인', primaryBiomarkers: ['Gingival index', 'Bleeding index', 'Pocket depth'], secondaryBiomarkers: ['치태 지수', '구강 미생물', '염증성 사이토카인'] }, preclinical: { cellModels: ['치은섬유아세포', '치주염균 배양'], animalModels: ['치주염 유도 동물'], biomarkers: ['P. gingivalis', 'IL-1β', 'TNF-α', '치조골 소실'] } },
  '장 건강': { clinical: { model: '배변 또는 장 불편감을 호소하는 성인', primaryBiomarkers: ['배변 빈도', 'Bristol stool scale', '복부 불편감'], secondaryBiomarkers: ['장내 미생물', 'SCFA', '삶의 질'] }, preclinical: { cellModels: ['장상피세포', '장내 미생물 발효 모델'], animalModels: ['변비, 설사 또는 장염 유도 동물'], biomarkers: ['장 통과시간', 'SCFA', 'tight junction protein', '염증성 사이토카인'] } },
  '전립선 건강': { clinical: { model: '전립선 관련 배뇨 증상을 보이는 남성', primaryBiomarkers: ['IPSS', '잔뇨량', '최대요속'], secondaryBiomarkers: ['PSA', '전립선 용적', '삶의 질'] }, preclinical: { cellModels: ['전립선 상피세포', '전립선 기질세포'], animalModels: ['testosterone 유도 전립선비대 동물'], biomarkers: ['DHT', '5α-reductase', '전립선 무게', '증식 관련 단백질'] } },
  '청력 유지': { clinical: { model: '청력 저하 위험 또는 소음 노출 대상자', primaryBiomarkers: ['순음청력검사', '어음명료도', '이명 설문'], secondaryBiomarkers: ['청각 피로도', '산화스트레스 지표'] }, preclinical: { cellModels: ['청각 유모세포', 'HEI-OC1'], animalModels: ['소음 또는 ototoxicity 유도 동물'], biomarkers: ['유모세포 생존율', 'ABR threshold', 'ROS', 'caspase-3'] } },
  '체지방 감소': { clinical: { model: '과체중 또는 체지방 관리가 필요한 성인', primaryBiomarkers: ['체지방량', '체지방률', '허리둘레'], secondaryBiomarkers: ['BMI', '지질대사 지표', 'adiponectin', 'leptin'] }, preclinical: { cellModels: ['3T3-L1 adipocyte'], animalModels: ['고지방식이 비만 동물'], biomarkers: ['지방세포 분화', 'PPARγ', 'C/EBPα', 'AMPK', '혈중 지질'] } },
  '치아 건강': { clinical: { model: '치아 우식 위험 또는 구강 건강 관리 대상자', primaryBiomarkers: ['치면세균막', '우식 관련 지표', '타액 pH'], secondaryBiomarkers: ['타액 분비량', '구강 미생물', '자가평가'] }, preclinical: { cellModels: ['구강 세균 biofilm', '법랑질 탈회 모델'], animalModels: ['치아 우식 유도 동물'], biomarkers: ['biofilm 형성', '탈회 깊이', 'S. mutans', '재광화 지표'] } },
  '칼슘 흡수 촉진': { clinical: { model: '칼슘 섭취 또는 골건강 관리가 필요한 성인', primaryBiomarkers: ['칼슘 흡수율', '혈청 칼슘', '소변 칼슘'], secondaryBiomarkers: ['PTH', '비타민 D', '골대사 지표'] }, preclinical: { cellModels: ['장상피세포', 'Caco-2'], animalModels: ['칼슘 결핍 또는 골대사 동물'], biomarkers: ['칼슘 수송', 'TRPV6', 'calbindin', '골밀도'] } },
  '콩팥에서 요독물질 관련': { clinical: { model: '요독물질 관리가 필요한 성인', primaryBiomarkers: ['indoxyl sulfate', 'p-cresyl sulfate', '혈중 요독물질'], secondaryBiomarkers: ['eGFR', 'BUN', 'creatinine', '염증 지표'] }, preclinical: { cellModels: ['신장 세포', '장내 미생물 발효 모델'], animalModels: ['신기능 저하 또는 요독물질 축적 동물'], biomarkers: ['BUN', 'creatinine', '요독물질', '신장 염증 및 섬유화'] } },
  '피로 개선': { clinical: { model: '피로감을 호소하는 성인', primaryBiomarkers: ['피로도 VAS', 'FSS', 'CIS'], secondaryBiomarkers: ['젖산', '코르티솔', 'CK', '삶의 질'] }, preclinical: { cellModels: ['근육세포', '미토콘드리아 기능 평가계'], animalModels: ['강제수영 또는 운동부하 동물'], biomarkers: ['운동 지속시간', '젖산', '글리코겐', 'SOD', 'MDA'] } },
  '피부 건강': { clinical: { model: '피부 보습, 탄력 또는 자외선 손상 관리 대상자', primaryBiomarkers: ['피부 수분량', 'TEWL', '피부 탄력'], secondaryBiomarkers: ['주름 지표', '멜라닌 지수', '피부 만족도'] }, preclinical: { cellModels: ['섬유아세포', '각질형성세포'], animalModels: ['UV 유도 피부손상 동물'], biomarkers: ['collagen', 'MMP-1', 'hyaluronic acid', '염증성 사이토카인'] } },
  '항산화': { clinical: { model: '산화스트레스 관리가 필요한 성인', primaryBiomarkers: ['MDA', '8-OHdG', '총 항산화능'], secondaryBiomarkers: ['SOD', 'GSH', 'GPx', '염증 지표'] }, preclinical: { cellModels: ['산화스트레스 유도 세포'], animalModels: ['산화스트레스 또는 노화 동물'], biomarkers: ['ROS', 'MDA', 'SOD', 'GSH', 'Nrf2'] } },
  '혈당 조절': { clinical: { model: '공복혈당 또는 당대사 경계역 성인', primaryBiomarkers: ['공복혈당', 'HbA1c', '식후혈당'], secondaryBiomarkers: ['인슐린', 'HOMA-IR', 'C-peptide'] }, preclinical: { cellModels: ['췌장 β세포', '근육세포', '간세포'], animalModels: ['고지방식이 또는 streptozotocin 유도 당대사 동물'], biomarkers: ['혈당', '인슐린', 'GLUT4', 'AMPK', '췌장 β세포 보호'] } },
  '혈압 조절': { clinical: { model: '정상고혈압 또는 경계역 혈압 성인', primaryBiomarkers: ['수축기 혈압', '이완기 혈압', '활동혈압'], secondaryBiomarkers: ['NO', 'ACE activity', '혈관탄성', '염증 지표'] }, preclinical: { cellModels: ['혈관내피세포', 'ACE 활성 평가계'], animalModels: ['고혈압 유도 동물'], biomarkers: ['혈압', 'ACE activity', 'NO', 'eNOS', '혈관 이완'] } },
  '혈중 중성지방 개선': { clinical: { model: '혈중 중성지방 경계역 성인', primaryBiomarkers: ['중성지방', '공복 지질', '식후 중성지방'], secondaryBiomarkers: ['총콜레스테롤', 'HDL-C', 'LDL-C', 'ApoB'] }, preclinical: { cellModels: ['간세포', '지방세포'], animalModels: ['고지방식이 이상지질혈증 동물'], biomarkers: ['중성지방', '지질 축적', 'AMPK', 'PPARα', '지방산 산화'] } },
  '혈중 콜레스테롤 개선': { clinical: { model: '혈중 콜레스테롤 경계역 성인', primaryBiomarkers: ['LDL-C', '총콜레스테롤', 'non-HDL-C'], secondaryBiomarkers: ['HDL-C', 'ApoB', '중성지방'] }, preclinical: { cellModels: ['간세포', '콜레스테롤 대사 평가계'], animalModels: ['고콜레스테롤식이 동물'], biomarkers: ['LDL-C', '담즙산 배설', 'HMGCR', 'LDLR', 'ABCA1'] } },
  '혈행 개선': { clinical: { model: '혈행 관리가 필요한 성인', primaryBiomarkers: ['혈소판 응집', '혈액 점도', '혈류 속도'], secondaryBiomarkers: ['NO', 'fibrinogen', 'D-dimer', '말초혈류'] }, preclinical: { cellModels: ['혈관내피세포', '혈소판 응집 평가계'], animalModels: ['혈전 또는 혈류장애 동물'], biomarkers: ['혈전 형성', '혈소판 응집', 'NO', 'eNOS', '혈관 이완'] } }
};

Object.assign(BIOMARKER_PROTOCOL_DEFS, {
  '간 건강': { clinical: { model: '만 19-75세 성인 중 영상의학적 방법(초음파, MRI 등)으로 지방간이 확인되고 ALT, AST가 정상치를 초과하되 정상 상한치의 3배 미만인 자' }, preclinical: { animalModels: ['고지방식이 유도 NAFLD/NASH 모델', 'CCl4 또는 thioacetamide 유도 간손상 모델', '알코올 또는 acetaminophen 유도 간독성 모델'] } },
  '갱년기 남성건강': { clinical: { model: '남성호르몬 결핍 의심 증상(신체·심리·심장대사·성적 증상)이 있고 총 테스토스테론이 정상 참고범위(예: 3.0 ng/mL 이상)에 있는 남성, 예: AMS 27-50점 및 총 테스토스테론 3.0-5.0 ng/mL' }, preclinical: { animalModels: ['노화 수컷 동물 모델', 'testosterone 저하 또는 orchiectomy 유도 모델', '대사증후군 동반 남성 갱년기 유사 모델'] } },
  '갱년기 여성건강': { clinical: { model: '폐경 이행기 또는 폐경 여성, FSH 30 mIU/mL 초과, 만 40-65세, 쿠퍼만 지수(Kupperman Index) 25점 이상 또는 임상적으로 갱년기 증상을 호소하는 자' }, preclinical: { animalModels: ['난소절제(OVX) 갱년기 모델', 'estrogen 결핍 골·혈관·체온조절 모델', '열감 또는 불안행동 평가 모델'] } },
  '구취': { clinical: { model: '구취 관능검사 또는 VSC가 기준치 이상이고 구강질환 치료가 급하지 않은 성인' }, preclinical: { animalModels: ['구강 혐기성균 또는 biofilm 기반 VSC 생성 모델', '설태·타액 조성 변화 모델', '구강 염증 동반 모델'] } },
  '근력 및 근기능': { clinical: { model: '50-85세 성인 중 악력 측정치가 표준치 이하인 자, 근기능은 SPPB 9점 초과이면서 보행속도·400m 걷기·의자 일어서기 등이 근감소증 진단범위에는 해당하지 않는 자' }, preclinical: { animalModels: ['덱사메타손 유도 근위축 모델', 'hindlimb unloading 또는 immobilization 비사용성 근위축 모델', '노화 유도 sarcopenia 모델', '운동부하/트레드밀 회복 모델'] } },
  '기관·기관지 건강 (기침·가래)': { clinical: { model: '기침·가래 등 기관지 불편감을 반복적으로 호소하되 약물치료가 필요한 호흡기 질환자는 제외한 성인' }, preclinical: { animalModels: ['LPS 유도 급성 폐염증 모델', 'ovalbumin(OVA) 또는 house dust mite 유도 기도과민 모델', '담배연기 또는 미세먼지 노출 기관지 염증 모델'] } },
  '긴장완화': { clinical: { model: '만 19-75세 성인 중 SRI 50-115점, PSS 13-16점, 긴장/스트레스 VAS 50% 이상, 또는 K-BDI-II 14-45점·K-BAI 8-45점·STAI 40-60점 등 경증-중등도 스트레스/불안 범위인 자' }, preclinical: { animalModels: ['구속 스트레스(restraint stress) 모델', '만성 예측불가 스트레스(CUMS) 모델', '수면박탈 또는 사회적 패배 스트레스 모델'] } },
  '눈 건강': { clinical: { model: '황반색소밀도: 만 40-85세, BMI 25-33 kg/m2, AMD 초기-중기 또는 관련 위험군. 눈 피로: 만 19-65세 건강인 중 전자기기 2-4시간/일 이상 사용 및 눈 피로도 slight-moderate. 건조한 눈: 만 19세 이상, 모니터 4시간/일 이상 사용' }, preclinical: { animalModels: ['청색광 또는 강광 노출 망막손상 모델', '건성 AMD 유사 산화스트레스 모델', '안구건조 유도 모델(눈물샘 절제, benzalkonium chloride, scopolamine 등)'] } },
  '다리 불편감(부기) 관련': { clinical: { model: '하지 부기, 무거움, 저림 등 다리 불편감을 호소하고 혈관성 또는 약물치료가 필요한 질환은 제외한 성인' }, preclinical: { animalModels: ['carrageenan 또는 histamine 유도 부종 모델', '정맥울혈/림프순환 저하 모델', '혈관투과성 증가 모델'] } },
  '면역과민반응': { clinical: { model: '알레르기성 비염·피부·호흡기 과민 증상을 호소하되 급성 치료가 필요한 중증 알레르기 질환자는 제외한 성인' }, preclinical: { animalModels: ['OVA 유도 알레르기 천식/비염 모델', 'DNFB 또는 DNCB 유도 접촉성 피부염 모델', 'compound 48/80 유도 비만세포 탈과립 모델'] } },
  '면역기능': { clinical: { model: '혈중 백혈구 수가 낮거나(3-4×10^3/μL) 너무 높지 않은(8-10×10^3/μL) 자, 또는 시험 시작 전 1년 이내 상기도감염 증상이 2회 이상 있었던 자' }, preclinical: { animalModels: ['cyclophosphamide 유도 면역저하 모델', 'LPS 또는 항원감작 면역반응 모델', 'OVA 면역글로불린 생성 모델'] } },
  '모발 건강': { clinical: { model: '탈락 모발 수 증가, 모발 밀도·굵기 저하 등 비질환성 모발 건강 저하를 보이는 성인' }, preclinical: { animalModels: ['제모 후 모주기(anagen) 전환 모델', 'testosterone 또는 DHT 유도 탈모 모델', '스트레스 유도 모발성장 저하 모델'] } },
  '배뇨 건강': { clinical: { model: '만 19세 이상 성인 중 요절박과 빈뇨가 3개월 이상 지속, OABSS 요절박 2점 이상 및 총점 3점 이상, 하루 평균 배뇨 8회 이상인 자' }, preclinical: { animalModels: ['cyclophosphamide 유도 방광염/과민성 방광 모델', 'acetic acid 유도 방광자극 모델', '부분 방광출구폐색 모델'] } },
  '뼈·관절 건강': { clinical: { model: '관절: 만 40-75세, 영상진단상 퇴행성 무릎 OA, KL grade I-II, VAS 30-100 mm, BMI 18.5-29.9 kg/m2. 뼈: 만 45세 이상 폐경 여성 중 요추 또는 고관절 BMD T-score -1.0 미만~-2.5 초과' }, preclinical: { animalModels: ['MIA 유도 골관절염 모델', 'DMM 또는 ACLT 물리적/수술적 관절손상 모델', 'collagenase 유도 관절염 모델', '난소절제(OVX) 골감소 모델'] } },
  '수면건강': { clinical: { model: '만 19세 이상 65세 미만 성인 중 수면 개시·유지 어려움, 조기각성, 비회복수면 증상이 주 1회 이상·2개월 이상 지속되고 PSQI 5점 이상인 자' }, preclinical: { animalModels: ['caffeine 또는 p-chlorophenylalanine(PCPA) 유도 불면 모델', '수면박탈 모델', '스트레스 유도 수면장애 모델'] } },
  '요로 건강': { clinical: { model: '요로 불편감 또는 반복적 요로 건강 관리가 필요한 성인, 급성 요로감염·항생제 치료 필요자는 제외' }, preclinical: { animalModels: ['uropathogenic E. coli 유도 요로감염 모델', '방광 상피세포 부착 억제 모델', 'LPS 유도 요로 염증 모델'] } },
  '운동수행능력': { clinical: { model: '만 19세 이상 건강한 성인남녀로 트레드밀 또는 사이클 에르고미터 수행이 가능하고, 고강도 운동 지속 수행자·BMI 18.5 이하 또는 30 이상·빈혈 등은 제외' }, preclinical: { animalModels: ['강제수영 부하 모델', '트레드밀 운동부하 모델', '탈진운동 후 회복 모델', '고지방식이 동반 운동능 저하 모델'] } },
  '월경전 불편감 개선': { clinical: { model: '만 19-45세 월경 중 여성, 월경주기 24-35일, 월경전증후군 설문에서 경증-중등도 PMS로 진단된 자' }, preclinical: { animalModels: ['hormone withdrawal 유도 PMS 유사 모델', 'oxytocin 또는 prostaglandin 유도 자궁수축/통증 모델', 'reserpine 또는 stress 유도 정서증상 모델'] } },
  '위 건강': { clinical: { model: '소화기능: 로마 IV(Rome IV) 기능성 소화불량 증상 중 1개 이상이 6개월 전 시작·최근 3개월 이상 지속되고 기질적 질환 근거가 없는 자. 위점막 보호: 상복부 통증 및 내시경상 손상이 있으나 약물치료가 급하지 않은 자' }, preclinical: { animalModels: ['ethanol/HCl 유도 위점막 손상 모델', 'indomethacin 또는 NSAID 유도 위손상 모델', 'water immersion restraint stress 유도 위궤양 모델', 'H. pylori 감염 모델'] } },
  '인지기능·기억력 개선': { clinical: { model: '인지기능: 만 55-85세 성인 중 인지 저하를 호소하고 DSM 치매 기준에는 해당하지 않는 자. 기억력: 만 19-85세 성인 중 기억력 저하를 호소하고 ADHD·치매 기준에는 해당하지 않는 자' }, preclinical: { animalModels: ['scopolamine 유도 기억력 저하 모델', 'Aβ 또는 APP/PS1 알츠하이머 유사 모델', 'D-galactose 또는 노화 유도 인지저하 모델'] } },
  '잇몸 건강': { clinical: { model: '만 19-80세 성인, 치주낭 탐침깊이 3-5 mm, 탐침 시 출혈, 치은염 또는 경증 치주염 증상, 잔존 자연치아 20개 이상인 자' }, preclinical: { animalModels: ['Porphyromonas gingivalis 유도 치주염 모델', 'ligature 유도 치주염 모델', 'LPS 유도 치은 염증 모델'] } },
  '장 건강': { clinical: { model: '배변활동: 로마 IV(Rome IV) 기능성 변비 기준(최근 3개월 중 2개 이상 증상, 주 3회 미만 배변 등)에 해당하는 자. 장 면역: 과체중/비만 등 만성질환자 또는 좌식 직업군. 장내균총: 식이통제가 가능한 건강한 성인' }, preclinical: { animalModels: ['loperamide 유도 변비 모델', 'DSS 또는 TNBS 유도 장염 모델', '항생제 유도 dysbiosis 모델', '고지방식이 장내균총 변화 모델'] } },
  '전립선 건강': { clinical: { model: '만 40-75세 남성, IPSS 8-19점 범위의 하부요로증상을 보이고 PSA 4.0 ng/mL 이상·최대요속 5 mL/s 미만·잔뇨 150 mL 이상 등은 제외' }, preclinical: { animalModels: ['testosterone propionate 유도 전립선비대 모델', 'DHT 유도 전립선 세포 증식 모델', '전립선 염증 동반 모델'] } },
  '청력 유지': { clinical: { model: '청력 저하 위험 또는 소음 노출 이력이 있으나 즉시 치료가 필요한 이과 질환은 제외한 성인' }, preclinical: { animalModels: ['소음성 난청 모델', 'cisplatin 또는 aminoglycoside 유도 이독성 모델', '노화성 난청 모델'] } },
  '체지방 감소': { clinical: { model: 'BMI 18.5-29.9 kg/m2 정상-과체중 범위이며 약물을 복용하지 않는 자, BMI 30-35 kg/m2 일부 포함 시 약물치료 필요자는 제외' }, preclinical: { animalModels: ['고지방식이 유도 비만 모델', 'ob/ob 또는 db/db 유전성 비만 모델', '식이유도 지방간 동반 비만 모델'] } },
  '치아 건강': { clinical: { model: '우식 경험 또는 초기우식병소 1개 이상, 자극성 타액 분비량 1.0 mL/min 이상, 자연치아 12개 이상인 자' }, preclinical: { animalModels: ['Streptococcus mutans 유도 치아우식 모델', '고당식이 우식 모델', '법랑질 탈회-재광화 모델'] } },
  '칼슘 흡수 촉진': { clinical: { model: '폐경기 여성(FSH 20 U/L 이상), 만 19세 이상 정상인, 또는 비타민 D 결핍자(25(OH)D < 20 ng/mL)' }, preclinical: { animalModels: ['칼슘 결핍식이 모델', '난소절제(OVX) 골대사 모델', '비타민 D 결핍 모델'] } },
  '콩팥에서 요독물질 관련': { clinical: { model: '요독물질 또는 신기능 관련 관리가 필요한 성인, 급성 신질환·투석·치료 변경이 필요한 대상자는 제외' }, preclinical: { animalModels: ['adenine 유도 만성신장질환 모델', '5/6 nephrectomy 신기능 저하 모델', 'indoxyl sulfate 또는 p-cresyl sulfate 축적 모델'] } },
  '피로 개선': { clinical: { model: '만 19세 이상 65세 미만 성인남녀 중 평소 피로감을 느끼고 경증 피로도 범위인 자, 예: VAS 28 또는 FSS 27점 이상' }, preclinical: { animalModels: ['강제수영 피로 모델', '트레드밀 탈진운동 모델', '수면박탈 또는 만성 스트레스 피로 모델'] } },
  '피부 건강': { clinical: { model: '건강인, 국소적 피부건조 증상자, 또는 짓무름 없는 국소적 경증 아토피 피부염 대상자' }, preclinical: { animalModels: ['UVB 유도 광노화/피부손상 모델', 'DNCB 또는 oxazolone 유도 아토피 피부염 모델', 'tape stripping 또는 건조피부 장벽손상 모델'] } },
  '항산화': { clinical: { model: '만 19세 이상 성인남녀, 항산화능에 영향을 주는 의약품·건강기능식품 지속 복용자는 제외' }, preclinical: { animalModels: ['D-galactose 유도 산화스트레스/노화 모델', 'H2O2 또는 t-BHP 유도 산화손상 모델', '고지방식이 또는 LPS 동반 산화스트레스 모델'] } },
  '혈당 조절': { clinical: { model: '공복혈당 정상(<100 mg/dL)에서 당뇨 전단계(100-125 mg/dL), 식후혈당 정상(<140 mg/dL)에서 당뇨 전단계(140-199 mg/dL)에 속하며 혈당강하제를 복용하지 않는 자' }, preclinical: { animalModels: ['streptozotocin(STZ) 유도 당뇨 모델', '고지방식이+저용량 STZ 인슐린저항성 모델', 'db/db 또는 ob/ob 당대사 이상 모델'] } },
  '혈압 조절': { clinical: { model: '혈압 정상·주의·고혈압 전단계 범위, 즉 SBP <140 mmHg 및 DBP <90 mmHg 내에서 약물을 복용하지 않는 자; 고혈압 1기 일부 포함 시 약물처방 필요자는 제외' }, preclinical: { animalModels: ['spontaneously hypertensive rat(SHR) 모델', 'L-NAME 유도 고혈압 모델', 'angiotensin II 또는 DOCA-salt 유도 고혈압 모델'] } },
  '혈중 중성지방 개선': { clinical: { model: '공복 혈중 중성지방이 정상(<150 mg/dL)에서 경계(150-199 mg/dL) 수준이고 약물을 복용하지 않는 자; 200-499 mg/dL 일부 포함 시 약물치료 필요자는 제외' }, preclinical: { animalModels: ['고지방식이 유도 고중성지방혈증 모델', 'poloxamer-407 또는 tyloxapol 유도 고지혈증 모델', 'fructose 유도 이상지질혈증 모델'] } },
  '혈중 콜레스테롤 개선': { clinical: { model: 'LDL-C가 적정(<100), 정상(100-129), 경계(130-159 mg/dL) 수준이고 지질개선 약물을 복용하지 않는 자; 160-189 mg/dL 일부 포함 시 약물치료 필요자는 제외' }, preclinical: { animalModels: ['고콜레스테롤식이 유도 고지혈증 모델', 'ApoE-/- 또는 LDLR-/- 동맥경화 모델', 'poloxamer-407 유도 고콜레스테롤혈증 모델'] } },
  '혈행 개선': { clinical: { model: '건강한 사람 중 collagen과 ADP 모두에서 혈소판 응집반응이 55-70% 이상인 자' }, preclinical: { animalModels: ['FeCl3 유도 혈전 모델', 'collagen/epinephrine 유도 폐혈전 모델', 'arteriovenous shunt 혈전 모델', 'ADP 또는 collagen 혈소판 응집 ex vivo 모델'] } }
});

// 기능성 평가 가이드와 최근 5년 공개 소비자리포트의 인체적용시험 평가 구조를 바탕으로 정리한 IRB 설계용 후보 지표.
// 실제 시험에서는 기능성 표현, 원료 작용기전 및 선행시험에 맞춰 1차 변수를 1-2개로 사전 특정한다.
var BIOMARKER_ENDPOINT_DETAILS = {
  '간 건강': {
    primary: ['ALT·AST·γ-GTP: 공복 혈청에서 기저치와 섭취 종료 시점의 변화량 및 군간 차이를 평가', '간 지방량: 초음파 등급 또는 MRI-PDFF로 동일 판독기준을 적용하여 기저치 대비 변화 평가'],
    secondary: ['ALP·총빌리루빈·중성지방·간염증 지표를 보조 유효성 및 안전성 지표로 평가', '피로도·삶의 질 설문과 체중·허리둘레를 탐색적 지표로 평가']
  },
  '갱년기 남성건강': {
    primary: ['AMS 총점 및 신체·심리·성기능 하위영역: 기저치 대비 변화량과 군간 차이 평가', '총·유리 테스토스테론: 오전 공복 채혈로 동일 시간대에 측정하고 기저치 대비 변화 평가'],
    secondary: ['IIEF 또는 ADAM 설문, 피로도·활력·수면 지표를 보조 평가', 'LH·FSH·SHBG와 PSA 등 호르몬 및 전립선 안전성 지표 평가']
  },
  '갱년기 여성건강': {
    primary: ['쿠퍼만 지수·MRS·MENQOL 총점: 기저치 대비 증상 개선 및 군간 차이를 평가', '안면홍조 일지: 일일 빈도·강도 및 중등도 이상 안면홍조 횟수의 변화량을 평가'],
    secondary: ['FSH·estradiol과 질건조·수면·기분 하위척도를 보조 평가', '자궁내막·유방 관련 검사와 이상반응을 안전성 항목으로 확인']
  },
  '구취': {
    primary: ['VSC(H2S·CH3SH·(CH3)2S): 휴대형 황화합물 측정기 또는 가스크로마토그래피를 이용한 표준화 측정', '관능검사 점수: 훈련된 평가자가 섭취 전후 동일 조건에서 관능평가 점수의 변화량을 평가'],
    secondary: ['설태지수·치태지수·타액분비량 및 타액 pH 평가', '구취 관련 구강미생물 정량과 대상자 자가평가 VAS를 탐색적으로 평가']
  },
  '근력 및 근기능': {
    primary: ['악력: 보정된 dynamometer로 우세손 또는 양손 반복 측정 후 최대값·평균값 변화 평가', '등속성 무릎신전근력 또는 1-RM: 표준화된 장비와 자세로 최대근력 변화 평가', 'SPPB·보행속도·의자일어서기: 사전 정의한 근기능 복합지표 변화 평가'],
    secondary: ['DXA/BIA 근육량·제지방량과 근육질 지표 평가', 'CK·LDH·근피로도·운동 후 회복시간 및 삶의 질 평가']
  },
  '기관·기관지 건강 (기침·가래)': {
    primary: ['기침·가래 일지: 일일 빈도·중증도·야간증상 및 무증상일수의 변화량을 평가', 'CAT·LCQ: 기능성에 적합한 호흡기 증상 총점의 기저치 대비 변화량을 평가'],
    secondary: ['FEV1·FVC·PEF 등 폐기능과 필요 시 기관지반응성 평가', '혈청·객담 염증지표와 호흡기 삶의 질, 구제약 사용량 평가']
  },
  '긴장완화': {
    primary: ['PSS·STAI 또는 SRI 총점: 사전 지정한 주척도의 기저치 대비 변화와 군간 차이 평가', '타액·혈청 cortisol: 채취 시각과 생활조건을 통제하여 일중 변화 또는 스트레스 반응 평가'],
    secondary: ['HRV의 SDNN·RMSSD·LF/HF와 안정시 심박수 평가', '기분·불안·수면 설문과 α-amylase 등 스트레스 관련 탐색지표 평가']
  },
  '눈 건강': {
    primary: ['건조한 눈: OSDI와 TBUT를 공동 또는 사전 지정 주평가변수로 설정하고 동일 검사자가 측정', '눈 피로: 표준화 시각작업 전후 눈 피로 VAS·설문 총점 변화 평가', '황반 건강: MPOD 또는 대비감도·광스트레스 회복시간을 기능성 표현에 맞춰 선택'],
    secondary: ['쉬르머 검사·각결막 염색·눈물 삼투압·시력: 객관적 안구건조 및 시기능 지표를 평가', 'NEI-VFQ: 시기능 관련 삶의 질과 눈물 염증지표를 보조 평가']
  },
  '다리 불편감(부기) 관련': {
    primary: ['하지 둘레 또는 체적: 사전 지정한 해부학적 위치·시간대·자세에서 반복 측정하여 변화량을 평가', '다리 불편감: 타당성이 검증된 증상 평가척도 또는 VAS를 이용하여 무거움·부기·통증의 변화량을 평가'],
    secondary: ['정맥초음파·말초혈류·피부온도 및 모세혈관 투과성 지표 평가', '부종 발생시간·일상활동 불편감과 삶의 질 평가']
  },
  '면역과민반응': {
    primary: ['증상 평가척도: 비염·피부·호흡기 영역별로 타당성이 검증된 증상 총점과 무증상일수의 변화량을 평가', '총·특이 IgE 및 호산구: 대상 질환과 알레르겐을 사전 지정하여 기저치 대비 변화량을 평가'],
    secondary: ['IL-4·IL-5·IL-13·histamine 등 Th2/비만세포 관련 지표 평가', '구제약 사용량, 삶의 질 및 피부·비강 객관지표를 보조 평가']
  },
  '면역기능': {
    primary: ['NK cell activity: 표준화된 effector-to-target ratio 또는 검증된 상용법으로 활성 변화 평가', '상기도감염 발생률·유병일수·증상중증도: 사전 정의한 감염사건과 일지로 평가'],
    secondary: ['림프구 아형·IgA·IL-2·IFN-γ 등 세포성·점막면역 지표 평가', '결석일수·구제약 사용량·CRP와 안전성 혈액검사 평가']
  },
  '모발 건강': {
    primary: ['포토트리코그램 모발 밀도·굵기: 동일 두피 표적부위를 표식하여 기저치 대비 변화량을 평가', '성장기/휴지기 모발 비율: 단위면적당 성장모발 수와 모발주기 비율의 변화량을 평가'],
    secondary: ['표준화 세정 후 탈락모발 수·인장강도·두피 상태 평가', '전문가 전반평가와 대상자 만족도·삶의 질 설문 평가']
  },
  '배뇨 건강': {
    primary: ['OABSS 또는 IPSS 총점·하위항목: 대상 기능성에 맞는 단일 주척도를 사전 지정하여 변화 평가', '3일 이상 배뇨일지의 24시간 배뇨횟수·요절박·야간뇨·요실금 횟수 변화 평가'],
    secondary: ['최대요속(Qmax)·평균요속·배뇨량·잔뇨량 평가', '배뇨 관련 삶의 질과 수면방해, 구제치료 사용 여부 평가']
  },
  '뼈·관절 건강': {
    primary: ['관절: WOMAC 총점 및 통증·강직·신체기능 하위점수와 활동 시 VAS 변화 평가', '뼈: DXA 요추·대퇴골 BMD 및 T-score를 동일 장비·분석조건으로 장기 추적 평가'],
    secondary: ['관절 기능검사·구제진통제 사용량과 CTX-II·COMP·CRP 평가', 'CTX·P1NP·osteocalcin·비타민 D 등 골대사 표지자와 골절위험 보조지표 평가']
  },
  '수면건강': {
    primary: ['PSQI 총점: 기저치와 섭취 종료 시점의 변화량 및 PSQI 개선 반응률 평가', '수면다원검사 또는 actigraphy의 수면효율·총수면시간·입면잠복기·WASO를 객관적 지표로 평가'],
    secondary: ['ISI·ESS와 수면일지의 각성횟수·주관적 수면의 질 평가', 'N3/REM 수면시간·멜라토닌·주간기능과 기분척도를 보조 평가']
  },
  '요로 건강': {
    primary: ['요로증상 점수와 배뇨통·빈뇨·절박뇨 발생일수의 변화 평가', '재발성 요로불편 사건 또는 의학적으로 확인된 요로감염 발생률·재발까지의 시간 평가'],
    secondary: ['소변 백혈구·세균수·nitrite 및 uropathogenic E. coli 부착 관련 지표 평가', '소변 pH·항생제 사용량·요로 관련 삶의 질 평가']
  },
  '운동수행능력': {
    primary: ['트레드밀·사이클의 탈진까지 운동시간 또는 사전 지정 거리 기록의 변화 평가', 'VO2max/VO2peak 또는 peak power를 표준화된 단계부하검사로 평가'],
    secondary: ['혈중 lactate·RPE·심박회복과 운동효율 평가', 'CK·LDH·암모니아·근육통 및 회복시간을 보조 평가']
  },
  '월경전 불편감 개선': {
    primary: ['DRSP 또는 MDQ 총점: 최소 2주기 전향적 일지로 황체기 증상 변화와 군간 차이 평가', '복부통증·유방압통·부종·기분증상 중 사전 지정 핵심증상의 VAS 변화 평가'],
    secondary: ['증상 없는 일수·일상활동 장애·구제진통제 사용량 평가', '삶의 질·수면·기분과 prostaglandin 등 탐색적 지표 평가']
  },
  '위 건강': {
    primary: ['위점막 보호: 내시경상 미란·발적·출혈의 표준화 점수를 이용하여 기저치 대비 변화량을 평가', '소화기능: GSRS·네피언 소화불량 지수 또는 로마 IV 기반 증상 총점의 변화량을 평가'],
    secondary: ['상복부통증·포만감·속쓰림 VAS와 증상 없는 일수 평가', 'H. pylori 관련 지표·위장관 삶의 질·구제약 사용량 평가']
  },
  '인지기능·기억력 개선': {
    primary: ['기억력 검사: 언어·시각 학습, 지연회상 및 재인을 포함하여 타당성이 검증된 검사 배터리의 변화량을 평가', '인지기능 검사: 주의력·실행기능·처리속도 중 기능성 표현에 적합한 복합점수를 사전 지정하여 평가'],
    secondary: ['MoCA·MMSE 등 전반인지와 주관적 기억감퇴 설문 평가', 'BDNF·뇌파·기분·수면 및 일상기능 지표를 탐색적으로 평가']
  },
  '잇몸 건강': {
    primary: ['GI·BOP: 보정된 검사자가 치은지수와 탐침 시 출혈 비율의 기저치 대비 변화량을 평가', 'PPD·CAL: 사전 지정 치아부위에서 치주낭 깊이와 임상 부착 수준을 반복 측정'],
    secondary: ['PI·치은열구액·치주미생물: 치태지수와 P. gingivalis 등 치주미생물을 평가', 'IL-1β·TNF-α: 국소 염증지표와 구강건강 관련 삶의 질을 평가']
  },
  '장 건강': {
    primary: ['배변활동: 주당 자발적·완전 자발적 배변횟수(CSBM)와 반응자 비율을 평가', '브리스톨 대변 형태 척도·PAC-SYM: 대변 형태와 변비·복부불편감 총점의 변화량을 평가'],
    secondary: ['장 통과시간·구제완하제 사용량·배변곤란 정도 평가', '장내미생물 다양성·표적균·SCFA와 장 관련 삶의 질 평가']
  },
  '전립선 건강': {
    primary: ['IPSS 총점 및 배뇨·저장 하위점수의 기저치 대비 변화와 임상적 반응률 평가', '최대요속(Qmax)과 배뇨 후 잔뇨량을 표준화 요속검사·초음파로 평가'],
    secondary: ['전립선 용적·PSA·야간뇨 횟수 평가', 'IPSS-QoL·성기능 및 구제치료 사용 여부 평가']
  },
  '청력 유지': {
    primary: ['순음청력검사의 주파수별 및 순음평균 역치 변화를 동일 방음·장비 조건에서 평가', '어음인지도·어음청취역치 또는 소음하 말소리인지 변화를 평가'],
    secondary: ['DPOAE·ABR threshold 등 객관적 청각반응 평가', '이명·청각피로·청력관련 삶의 질과 산화스트레스 지표 평가']
  },
  '체지방 감소': {
    primary: ['DXA 또는 CT로 측정한 총 체지방량·체지방률·복부/내장지방 면적의 기저치 대비 변화 평가', '허리둘레를 표준 해부학적 위치에서 반복 측정하여 군간 변화 비교'],
    secondary: ['체중·BMI·허리엉덩이둘레비와 제지방량 평가', '지질·인슐린저항성·adiponectin·leptin 및 식이·활동량 평가']
  },
  '치아 건강': {
    primary: ['새 우식병소·초기우식 진행 또는 DMFS/DMFT 변화량을 표준 진단기준으로 평가', '치면세균막·산생성도와 타액 pH 회복곡선을 표준화 당부하 전후 평가'],
    secondary: ['타액분비량·완충능·우식 관련 세균: S. mutans와 유산균속의 균수를 평가', '법랑질 탈회·재광화 지표와 구강건강 자가평가를 보조 평가']
  },
  '칼슘 흡수 촉진': {
    primary: ['분획 칼슘 흡수율: 안정동위원소법으로 측정한 칼슘 흡수율 또는 칼슘 체내 보유율을 주평가변수로 사전 지정', '칼슘 부하검사: 표준 칼슘부하 후 혈청·소변 칼슘 변화량 또는 AUC를 동일 채취일정으로 평가'],
    secondary: ['PTH·25(OH)D·인·마그네슘과 CTX·P1NP 등 골대사 지표 평가', '장기시험 시 DXA 골밀도와 칼슘 관련 이상반응 평가']
  },
  '콩팥에서 요독물질 관련': {
    primary: ['혈청 total/free indoxyl sulfate와 p-cresyl sulfate 농도의 기저치 대비 변화 평가', '기능성 표현에 따라 요독물질 복합지수 또는 사전 지정 단일 물질의 군간 차이 평가'],
    secondary: ['eGFR·creatinine·BUN·cystatin C 등 신기능 보조지표 평가', '장내미생물·염증·산화스트레스와 배변 관련 지표 평가']
  },
  '피로 개선': {
    primary: ['FSS·CIS·Chalder 피로 척도: 타당성이 검증된 주평가척도 총점의 변화량을 평가', '피로 VAS: 피로도와 일상기능 저하 정도를 동일 시점에서 반복 평가'],
    secondary: ['운동부하 후 lactate·암모니아·CK와 회복시간 평가', '수면·기분·삶의 질·cortisol 및 활동량을 보조 평가']
  },
  '피부 건강': {
    primary: ['보습: corneometer 피부수분량과 TEWL을 온·습도 순응 후 동일 부위에서 평가', '탄력·주름: cutometer 지표와 3D 피부영상의 주름 깊이·면적 변화 평가', '자외선 손상: 최소홍반량·홍반지수 또는 광노화 지표를 기능성 표현에 맞춰 선택'],
    secondary: ['melanin index·피부거칠기·피부장벽 회복과 전문가 평가', '대상자 만족도·피부 삶의 질 및 염증·산화스트레스 지표 평가']
  },
  '항산화': {
    primary: ['MDA·F2-isoprostane·8-OHdG: 지질 또는 DNA 산화손상 지표 중 주평가변수를 사전 지정하여 변화량을 평가', 'TAC·ORAC: 총 항산화능을 동일 분석법으로 측정하여 기저치 대비 변화량을 평가'],
    secondary: ['SOD·GPx·catalase·GSH/GSSG 등 내인성 항산화 방어지표 평가', 'CRP·염증성 cytokine과 산화 LDL 등 탐색지표 평가']
  },
  '혈당 조절': {
    primary: ['공복혈당과 HbA1c의 기저치 대비 변화량 및 군간 차이 평가', '표준 식사부하 후 0-120분 혈당 iAUC·2시간 혈당을 사전 지정 일정으로 평가'],
    secondary: ['공복·식후 인슐린·HOMA-IR·마쓰다 지수: 인슐린 분비 및 감수성을 평가', 'C-peptide·프럭토사민·연속혈당 변동성 및 지질대사 지표를 평가']
  },
  '혈압 조절': {
    primary: ['진료실 수축기·이완기혈압: 표준 휴식 후 반복 측정 평균의 기저치 대비 변화 평가', '24시간 활동혈압의 주간·야간 평균 또는 사전 지정 시간대 혈압 변화 평가'],
    secondary: ['맥압·중심혈압·PWV·혈관탄성 평가', 'ACE activity·renin·aldosterone·NO와 심박수 평가']
  },
  '혈중 중성지방 개선': {
    primary: ['공복 혈청 중성지방: 기저치 대비 절대·백분율 변화량과 군간 차이를 평가', '식후 중성지방: 지방부하 시험 후 0-6시간 iAUC 또는 최고 반응값을 평가'],
    secondary: ['총콜레스테롤·LDL-C·HDL-C·non-HDL-C·ApoB 평가', 'VLDL·유리지방산·간지방 및 인슐린저항성 지표 평가']
  },
  '혈중 콜레스테롤 개선': {
    primary: ['LDL-C의 기저치 대비 절대·백분율 변화와 군간 차이 평가', '총콜레스테롤 또는 non-HDL-C를 사전 지정 공동·보조 유효성 지표로 평가'],
    secondary: ['HDL-C·중성지방·ApoB·ApoA1 및 LDL 입자 지표를 평가', '산화 LDL·담즙산 배설과 염증지표를 탐색적으로 평가']
  },
  '혈행 개선': {
    primary: ['콜라겐·ADP 유도 혈소판 응집: 동일한 작용제 농도와 분석법으로 응집률 및 최대응집률을 평가', '전혈·혈장 점도 또는 적혈구 변형능의 기저치 대비 변화량을 평가'],
    secondary: ['말초혈류·FMD·레이저 도플러 및 NO 관련 지표를 평가', 'fibrinogen·D-dimer·PT·aPTT와 출혈 관련 안전성 항목을 평가']
  }
};

// 식품의약품안전평가원 「건강기능식품 기능성 평가를 위한 주요 용어집」(2024.9.)의 영문명·약어·한글명을 기준으로 구성한다.
var BIOMARKER_TERM_GLOSSARY = {
  'MRI-PDFF': { en: 'magnetic resonance imaging-proton density fat fraction', ko: '자기공명영상 양성자밀도 지방분율' },
  'AMS': { en: 'Aging Males\' Symptoms questionnaire', ko: '남성 갱년기 평가 설문지' },
  'IIEF': { en: 'International Index of Erectile Function questionnaire', ko: '국제 성기능 지표 설문지' },
  'ADAM': { en: 'Androgen Deficiency in the Aging Male questionnaire', ko: '남성 갱년기 증상 설문지' },
  'ALT': { en: 'alanine aminotransferase', ko: '알라닌 아미노전이효소' },
  'AST': { en: 'aspartate aminotransferase', ko: '아스파르트산 아미노전이효소' },
  'γ-GTP': { en: 'gamma-glutamyl transpeptidase', ko: '감마-글루타밀 전이효소' },
  'ALP': { en: 'alkaline phosphatase', ko: '알칼리 인산분해효소' },
  'LH': { en: 'luteinizing hormone', ko: '황체 형성 호르몬' },
  'FSH': { en: 'follicle-stimulating hormone', ko: '난포 자극 호르몬' },
  'SHBG': { en: 'sex hormone-binding globulin', ko: '성호르몬 결합 글로불린' },
  'PSA': { en: 'prostate-specific antigen', ko: '전립선 특이 항원' },
  'MRS': { en: 'Menopause Rating Scale', ko: '갱년기 평가지수' },
  'MENQOL': { en: 'Menopause-Specific Quality of Life questionnaire', ko: '갱년기 삶의 질 평가' },
  'VSC': { en: 'volatile sulfur compounds', ko: '휘발성 황화합물' },
  'H2S': { en: 'hydrogen sulfide', ko: '황화수소' },
  'CH3SH': { en: 'methyl mercaptan', ko: '메틸메르캅탄' },
  'SPPB': { en: 'Short Physical Performance Battery', ko: '간편 신체기능 검사' },
  'DXA': { en: 'dual-energy X-ray absorptiometry', ko: '이중에너지 엑스선 흡수계측법' },
  'BIA': { en: 'bioelectrical impedance analysis', ko: '생체 전기 저항 분석법' },
  'CK': { en: 'creatine kinase', ko: '크레아틴 인산효소' },
  'LDH': { en: 'lactate dehydrogenase', ko: '젖산 탈수소효소' },
  'CAT': { en: 'COPD Assessment Test', ko: '만성폐쇄성폐질환 평가검사' },
  'LCQ': { en: 'Leicester Cough Questionnaire', ko: '레스터 기침 설문지' },
  'FEV1': { en: 'forced expiratory volume in one second', ko: '1초간 노력성 호기량' },
  'FVC': { en: 'forced vital capacity', ko: '노력성 폐활량' },
  'PEF': { en: 'peak expiratory flow', ko: '최대 호기 유량' },
  'PSS': { en: 'Perceived Stress Scale', ko: '스트레스 자각 척도' },
  'STAI': { en: 'State-Trait Anxiety Inventory', ko: '상태-특성 불안 척도' },
  'SRI': { en: 'Stress Response Inventory', ko: '스트레스 반응 척도' },
  'HRV': { en: 'heart rate variability', ko: '심박 변이도' },
  'SDNN': { en: 'standard deviation of normal-to-normal intervals', ko: '정상 심박동 간격의 표준편차' },
  'RMSSD': { en: 'root mean square of successive differences', ko: '연속 심박동 간격 차이의 제곱평균제곱근' },
  'OSDI': { en: 'Ocular Surface Disease Index', ko: '안구 표면 질환지수' },
  'TBUT': { en: 'tear film break-up time', ko: '눈물막 파괴시간 검사' },
  'MPOD': { en: 'macular pigment optical density', ko: '황반 색소 밀도' },
  'NEI-VFQ': { en: 'National Eye Institute Visual Function Questionnaire', ko: '미국 국립안연구소 시기능 설문지' },
  'VAS': { en: 'visual analogue scale', ko: '시각상사척도' },
  'IgE': { en: 'immunoglobulin E', ko: '면역글로불린 E' },
  'NK': { en: 'natural killer cell', ko: '자연살해세포' },
  'CRP': { en: 'C-reactive protein', ko: 'C-반응성 단백질' },
  'OABSS': { en: 'Overactive Bladder Symptom Score', ko: '과민성 방광 증상 점수' },
  'IPSS': { en: 'International Prostate Symptom Score', ko: '국제 전립선 증상점수' },
  'Qmax': { en: 'maximum urinary flow rate', ko: '최대 요속' },
  'WOMAC': { en: 'Western Ontario and McMaster Universities Osteoarthritis Index', ko: '웨스턴 온타리오·맥마스터 대학교 골관절염 지수' },
  'CTX-II': { en: 'C-terminal cross-linked telopeptide of type II collagen', ko: '제2형 콜라겐 C-말단 가교 텔로펩타이드' },
  'COMP': { en: 'cartilage oligomeric matrix protein', ko: '연골 올리고머 기질 단백질' },
  'CTX': { en: 'C-terminal telopeptide', ko: 'C-말단 텔로펩타이드' },
  'P1NP': { en: 'procollagen type 1 N-terminal propeptide', ko: '제1형 프로콜라겐 N-말단 프로펩타이드' },
  'PSQI': { en: 'Pittsburgh Sleep Quality Index', ko: '피츠버그 수면의 질 지표' },
  'ISI': { en: 'Insomnia Severity Index', ko: '불면증 중증도 지표' },
  'ESS': { en: 'Epworth Sleepiness Scale', ko: '엡워스 주간졸림척도' },
  'WASO': { en: 'wake after sleep onset', ko: '입면 후 각성시간' },
  'N3': { en: 'non-rapid eye movement stage 3 sleep', ko: '비렘수면 3단계' },
  'REM': { en: 'rapid eye movement sleep', ko: '렘수면' },
  'VO2max': { en: 'maximal oxygen uptake', ko: '최대 산소 섭취량' },
  'VO2peak': { en: 'peak oxygen uptake', ko: '최고 산소 섭취량' },
  'RPE': { en: 'rating of perceived exertion', ko: '운동자각도' },
  'DRSP': { en: 'Daily Record of Severity of Problems', ko: '월경전 증상 일일 기록지' },
  'MDQ': { en: 'Menstrual Distress Questionnaire', ko: '월경 불편감 설문지' },
  'GSRS': { en: 'Gastrointestinal Symptom Rating Scale', ko: '위장 장애 증상 평가 척도' },
  'MoCA': { en: 'Montreal Cognitive Assessment', ko: '몬트리올 인지평가' },
  'MMSE': { en: 'Mini-Mental State Examination', ko: '간이 정신상태 검사' },
  'BDNF': { en: 'brain-derived neurotrophic factor', ko: '뇌 유래 신경 영양인자' },
  'BOP': { en: 'bleeding on probing', ko: '치은 출혈 지수' },
  'PPD': { en: 'probing pocket depth', ko: '치주낭 깊이' },
  'CAL': { en: 'clinical attachment level', ko: '임상 부착 수준' },
  'CSBM': { en: 'complete spontaneous bowel movement', ko: '완전 자발적 배변' },
  'PAC-SYM': { en: 'Patient Assessment of Constipation-Symptoms', ko: '환자보고형 변비 증상 평가' },
  'DPOAE': { en: 'distortion product otoacoustic emissions', ko: '변조 이음향방사' },
  'ABR': { en: 'auditory brainstem response', ko: '청성뇌간반응' },
  'DMFS': { en: 'decayed, missing and filled surfaces', ko: '우식·상실·충전 치면 지수' },
  'DMFT': { en: 'decayed, missing and filled teeth', ko: '우식·상실·충전 치아 지수' },
  'PTH': { en: 'parathyroid hormone', ko: '부갑상선 호르몬' },
  '25(OH)D': { en: '25-hydroxyvitamin D', ko: '25-수산화비타민 D' },
  'AUC': { en: 'area under the curve', ko: '곡선하면적' },
  'eGFR': { en: 'estimated glomerular filtration rate', ko: '추정 사구체 여과율' },
  'BUN': { en: 'blood urea nitrogen', ko: '혈액 요소 질소' },
  'FSS': { en: 'Fatigue Severity Scale', ko: '피로 설문 척도' },
  'CIS': { en: 'Checklist Individual Strength', ko: '자각 피로 측정 도구' },
  'TEWL': { en: 'transepidermal water loss', ko: '경피 수분 손실량' },
  'MDA': { en: 'malondialdehyde', ko: '말론디알데히드' },
  '8-OHdG': { en: '8-hydroxy-2-deoxyguanosine', ko: '8-옥소-데옥시구아노신' },
  'TAC': { en: 'total antioxidant capacity', ko: '총 항산화 용량' },
  'ORAC': { en: 'oxygen radical absorbance capacity', ko: '산소 라디칼 흡수 능력' },
  'SOD': { en: 'superoxide dismutase', ko: '과산화물 제거효소' },
  'GPx': { en: 'glutathione peroxidase', ko: '글루타티온 과산화효소' },
  'HbA1c': { en: 'glycated hemoglobin', ko: '당화혈색소' },
  'iAUC': { en: 'incremental area under the curve', ko: '증분 곡선하면적' },
  'HOMA-IR': { en: 'Homeostasis Model Assessment of Insulin Resistance', ko: '인슐린 저항성 지수' },
  'SBP': { en: 'systolic blood pressure', ko: '수축기 혈압' },
  'DBP': { en: 'diastolic blood pressure', ko: '이완기 혈압' },
  'ABPM': { en: 'ambulatory blood pressure monitoring', ko: '24시간 활동 혈압 측정' },
  'PWV': { en: 'pulse wave velocity', ko: '맥파 전달 속도' },
  'LDL-C': { en: 'low-density lipoprotein cholesterol', ko: '저밀도 지단백 콜레스테롤' },
  'HDL-C': { en: 'high-density lipoprotein cholesterol', ko: '고밀도 지단백 콜레스테롤' },
  'ApoB': { en: 'apolipoprotein B', ko: '아포지단백질 B' },
  'ApoA1': { en: 'apolipoprotein A1', ko: '아포지단백질 A1' },
  'FMD': { en: 'flow-mediated dilation', ko: '혈류매개 혈관확장' },
  'NO': { en: 'nitric oxide', ko: '산화질소' },
  'PT': { en: 'prothrombin time', ko: '프로트롬빈 시간' },
  'aPTT': { en: 'activated partial thromboplastin time', ko: '활성화 부분 트롬보플라스틴 시간' }
  ,'ACE': { en: 'angiotensin-converting enzyme', ko: '안지오텐신-전환효소' }
  ,'ADP': { en: 'adenosine diphosphate', ko: '아데노신 이인산' }
  ,'BMD': { en: 'bone mineral density', ko: '골밀도' }
  ,'BMI': { en: 'body mass index', ko: '체질량지수' }
  ,'C-peptide': { en: 'connecting peptide', ko: 'C-펩타이드' }
  ,'D-dimer': { en: 'D-dimer', ko: 'D-이합체' }
  ,'F2-isoprostane': { en: 'F2-isoprostane', ko: 'F2-이소프로스탄' }
  ,'GSH/GSSG': { en: 'reduced glutathione/oxidized glutathione ratio', ko: '환원형·산화형 글루타티온 비' }
  ,'LF/HF': { en: 'low-frequency/high-frequency power ratio', ko: '저주파·고주파 성분 비' }
  ,'IgA': { en: 'immunoglobulin A', ko: '면역글로불린 A' }
  ,'IFN-γ': { en: 'interferon gamma', ko: '인터페론 감마' }
  ,'IL-1β': { en: 'interleukin-1 beta', ko: '인터루킨-1 베타' }
  ,'IL-2': { en: 'interleukin-2', ko: '인터루킨-2' }
  ,'IL-4': { en: 'interleukin-4', ko: '인터루킨-4' }
  ,'IL-5': { en: 'interleukin-5', ko: '인터루킨-5' }
  ,'IL-13': { en: 'interleukin-13', ko: '인터루킨-13' }
  ,'TNF-α': { en: 'tumor necrosis factor alpha', ko: '종양괴사인자 알파' }
  ,'Th2': { en: 'type 2 helper T cell', ko: '제2형 보조 T세포' }
  ,'SCFA': { en: 'short-chain fatty acids', ko: '단쇄지방산' }
  ,'VLDL': { en: 'very-low-density lipoprotein', ko: '초저밀도 지단백' }
  ,'LDL': { en: 'low-density lipoprotein', ko: '저밀도 지단백' }
  ,'T-score': { en: 'T-score', ko: '티 점수' }
  ,'pH': { en: 'potential of hydrogen', ko: '수소이온농도지수' }
  ,'GI': { en: 'Gingival Index', ko: '치은지수' }
  ,'PI': { en: 'Plaque Index', ko: '치태지수' }
  ,'DNA': { en: 'deoxyribonucleic acid', ko: '데옥시리보핵산' }
};

var BIOMARKER_MECHANISM_DEFS = {
  '간 건강': ['간세포 손상 억제와 ALT/AST 등 간 효소 개선', '지방산 합성·산화 및 간 내 지질축적 조절', '산화스트레스와 염증성 사이토카인 완화를 통한 간조직 보호'],
  '갱년기 남성건강': ['남성호르몬 생성·대사 및 androgen 신호 조절', '피로, 활력, 성기능 관련 신경내분비 균형 개선', '전립선 및 대사 안전성 지표를 동반한 남성 갱년기 증상 완화'],
  '갱년기 여성건강': ['에스트로겐 저하에 따른 혈관운동성 증상 완화', 'FSH·estradiol 등 성호르몬 균형 및 HPA axis 조절', '골대사·수면·기분 관련 갱년기 동반 증상 개선'],
  '구취': ['휘발성 황화합물(VSC) 생성 억제', '구강 혐기성 세균과 biofilm 형성 조절', '설태, 타액, 구강 염증 환경 개선'],
  '근력 및 근기능': ['근단백질 합성 촉진과 분해 경로 억제', '미토콘드리아 에너지 대사 및 운동 후 회복 개선', '염증·산화스트레스 완화를 통한 근위축 억제'],
  '기관·기관지 건강 (기침·가래)': ['기도 염증반응 및 Th2 cytokine 조절', '점액 과분비와 MUC5AC 발현 억제', '산화스트레스 및 외부 자극에 대한 기관지 상피 보호'],
  '긴장완화': ['HPA axis와 cortisol 반응 조절', 'GABA, serotonin, dopamine 등 신경전달 균형 조절', '스트레스 유발 산화스트레스와 신경염증 완화'],
  '눈 건강': ['망막 산화스트레스 및 광손상 억제', '황반색소·항산화 방어계 유지', '눈물막 안정성, 염증, 상피 손상 완화를 통한 눈 피로·건조 개선'],
  '다리 불편감(부기) 관련': ['혈관투과성 및 조직 부종 반응 완화', '정맥·림프 순환과 말초혈류 개선', '염증성 매개체와 산화스트레스 조절'],
  '면역과민반응': ['IgE와 비만세포 탈과립 반응 억제', 'Th1/Th2 균형 및 IL-4, IL-5, IL-13 등 과민 cytokine 조절', '알레르겐 유발 염증세포 침윤과 조직 염증 완화'],
  '면역기능': ['NK cell activity와 선천면역 반응 조절', '림프구 아형, IgA, cytokine 균형을 통한 면역 항상성 유지', '감염 방어 관련 점막면역 및 염증반응 조절'],
  '모발 건강': ['모유두세포 활성과 성장기(anagen) 전환 촉진', 'Wnt/β-catenin, IGF-1, VEGF 등 모낭 성장 신호 조절', 'DHT 또는 스트레스성 모낭 위축 반응 완화'],
  '배뇨 건강': ['방광 수축·이완 및 감각신경 과민 조절', '방광 염증과 산화스트레스 완화', '전립선·방광 관련 배뇨 지표 개선'],
  '뼈·관절 건강': ['연골기질 분해효소(MMP 등) 억제와 연골 보호', '염증성 관절반응 및 통증 매개체 조절', '조골·파골세포 균형과 골대사 지표 개선'],
  '수면건강': ['GABAergic 신경전달 및 수면-각성 조절 경로 조절', 'melatonin, serotonin 등 생체리듬 관련 신호 보조', '스트레스·각성 반응 완화를 통한 수면의 질 개선'],
  '요로 건강': ['요로상피세포에 대한 uropathogenic E. coli 부착 억제', '방광·요로 염증반응 완화', '소변 환경과 재발 관련 위험요인 조절'],
  '운동수행능력': ['근육 에너지 생성과 미토콘드리아 기능 향상', '젖산 축적, CK, 피로 관련 대사 부담 완화', '글리코겐 저장 및 운동 후 회복 지표 개선'],
  '월경전 불편감 개선': ['호르몬 변화에 따른 prostaglandin·염증 매개체 조절', '통증, 부종, 기분 변화 관련 신경내분비 반응 완화', '자궁수축 및 산화스트레스 관련 불편감 개선'],
  '위 건강': ['위점막 방어인자와 점액층 보호', '산, NSAID, ethanol, 스트레스에 의한 위점막 손상 완화', 'H. pylori 및 염증성 매개체 조절을 통한 위 불편감 개선'],
  '인지기능·기억력 개선': ['콜린성 신경전달과 AChE 관련 기억 경로 조절', 'BDNF, synaptic plasticity 등 신경가소성 보조', 'Aβ, 산화스트레스, 신경염증 완화를 통한 인지기능 보호'],
  '잇몸 건강': ['치주병원균 및 biofilm 관련 염증 반응 억제', '치은 출혈, 치주낭, 치조골 손실 관련 조직 보호', 'IL-1β, TNF-α 등 치주 염증 매개체 조절'],
  '장 건강': ['장운동, 장 통과시간, 배변 리듬 조절', '장내 미생물 균형과 SCFA 생성 조절', '장점막 장벽, tight junction, 장 염증 반응 개선'],
  '전립선 건강': ['androgen/DHT 및 5α-reductase 관련 전립선 증식 신호 조절', '전립선 염증과 산화스트레스 완화', '하부요로증상과 배뇨 흐름 관련 지표 개선'],
  '청력 유지': ['소음·이독성 물질에 의한 유모세포 손상 억제', '와우 산화스트레스와 apoptosis 경로 완화', '청각신경 반응 및 ABR threshold 보호'],
  '체지방 감소': ['지방세포 분화 및 지방생성 관련 전사인자 조절', 'AMPK 활성, 지방산 산화, 에너지 소비 촉진', '인슐린저항성·염증을 동반한 비만 대사환경 개선'],
  '치아 건강': ['S. mutans 등 우식균 부착 및 biofilm 형성 억제', '법랑질 탈회 억제와 재광화 보조', '타액 pH, 타액분비, 구강 미생물 균형 조절'],
  '칼슘 흡수 촉진': ['장관 칼슘 수송 단백질(TRPV6, calbindin 등) 발현 조절', '비타민 D, PTH 등 칼슘 항상성 관련 경로 보조', '골밀도와 골대사 지표 개선'],
  '콩팥에서 요독물질 관련': ['장내 미생물 유래 요독물질 생성 저감', 'indoxyl sulfate, p-cresyl sulfate 등 요독물질 축적 완화', '신장 염증·산화스트레스·섬유화 반응 조절'],
  '피로 개선': ['에너지 대사와 ATP 생성 보조', '젖산, 암모니아, CK 등 피로 관련 대사산물 조절', '항산화 방어와 운동·스트레스 후 회복 개선'],
  '피부 건강': ['피부장벽, 보습, TEWL 관련 지표 개선', 'collagen 합성 보조와 MMP 억제를 통한 탄력·주름 개선', 'UV 또는 알레르기성 염증에 의한 산화스트레스 완화'],
  '항산화': ['ROS 생성 억제 및 산화손상 지표(MDA, 8-OHdG 등) 개선', 'SOD, GSH, GPx 등 내인성 항산화 방어계 활성화', 'Nrf2 관련 항산화 반응 및 염증 완화'],
  '혈당 조절': ['인슐린 감수성과 HOMA-IR 관련 당대사 개선', 'GLUT4, AMPK 등 포도당 흡수·이용 경로 조절', '췌장 β세포 보호와 식후혈당 상승 완화'],
  '혈압 조절': ['ACE 활성 억제와 renin-angiotensin system 조절', 'NO/eNOS 경로를 통한 혈관 이완 보조', '혈관 염증·산화스트레스와 혈관탄성 지표 개선'],
  '혈중 중성지방 개선': ['간 내 지방산 합성 억제와 β-oxidation 촉진', 'VLDL 생성·분비 및 지질 운반 대사 조절', '식후 중성지방 상승과 이상지질혈증 관련 염증 완화'],
  '혈중 콜레스테롤 개선': ['HMGCR, LDLR 등 콜레스테롤 합성·흡수·제거 경로 조절', '담즙산 배설 및 장관 콜레스테롤 흡수 조절', 'LDL 산화와 혈관 염증 반응 완화'],
  '혈행 개선': ['혈소판 응집과 thromboxane 관련 혈전 형성 억제', 'NO/eNOS 기반 혈관 이완과 말초혈류 개선', '혈액점도, fibrinogen, D-dimer 등 혈행 관련 지표 조절']
};

var BIOMARKER_OCR_BACKFILL = new Set([
  '구취',
  '근력 및 근기능',
  '긴장완화',
  '배뇨 건강',
  '수면건강',
  '운동수행능력',
  '월경전 불편감 개선',
  '잇몸 건강',
  '전립선 건강',
  '청력 유지',
  '콩팥에서 요독물질 관련',
  '피로 개선',
  '갱년기 남성건강',
  '갱년기 여성건강',
  '기관·기관지 건강 (기침·가래)',
  '다리 불편감(부기) 관련'
]);

var BIOMARKER_DEFAULT_PROTOCOL = {
  clinical: {
    design: '무작위배정, 이중눈가림, 위약대조 인체적용시험을 기본으로 하며 기능성 특성에 맞는 대상자 선정과 사전 정의된 주평가지표를 사용한다.',
    model: '해당 기능성의 개선 필요성이 있거나 경계역에 해당하는 성인',
    duration: '기능성별 가이드와 선행 인체적용시험을 근거로 8-12주 이상을 우선 검토한다.',
    primaryBiomarkers: ['기능성별 주평가지표'],
    secondaryBiomarkers: ['안전성 혈액검사', '삶의 질 또는 증상 설문']
  },
  preclinical: {
    design: '세포 또는 동물모델에서 작용기전, 유효성 지표, 용량반응성을 함께 확인한다.',
    cellModels: ['기능성 관련 표적 세포'],
    animalModels: ['기능성 관련 유도 동물모델'],
    biomarkers: ['기능성별 핵심 바이오마커', '염증 또는 산화스트레스 지표', '조직학적 평가']
  },
  mechanisms: ['기능성 관련 생리활성 경로 조절', '핵심 바이오마커 변화와 연결되는 작용기전 확인', '안전성 지표를 동반한 유효성 방향성 검토']
};

function mergeBiomarkerProtocol(name, guideFile) {
  var specific = BIOMARKER_PROTOCOL_DEFS[name] || {};
  var endpointDetails = BIOMARKER_ENDPOINT_DETAILS[name] || {};
  var clinical = Object.assign({}, BIOMARKER_DEFAULT_PROTOCOL.clinical, specific.clinical || {});
  clinical.primaryEndpointDetails = endpointDetails.primary || clinical.primaryBiomarkers;
  clinical.secondaryEndpointDetails = endpointDetails.secondary || clinical.secondaryBiomarkers;
  return {
    guideFile: guideFile,
    clinical: clinical,
    preclinical: Object.assign({}, BIOMARKER_DEFAULT_PROTOCOL.preclinical, specific.preclinical || {}),
    mechanisms: specific.mechanisms || BIOMARKER_MECHANISM_DEFS[name] || BIOMARKER_DEFAULT_PROTOCOL.mechanisms,
    extractionMethod: BIOMARKER_OCR_BACKFILL.has(name) ? 'ocr_backfill' : 'guide_seed'
  };
}

var BIOMARKER_PROTOCOLS = {};
(function buildBiomarkerProtocols() {
  var guidelines = (typeof GUIDELINE_FILES !== 'undefined') ? GUIDELINE_FILES : [];
  guidelines
    .filter(function(g) { return g.type === '기능성'; })
    .forEach(function(g) {
      BIOMARKER_PROTOCOLS[g.name] = mergeBiomarkerProtocol(g.name, g.file);
    });
})();
