// Manual news refresh: 2026-07-03 KST.
(function () {
  function prependUnique(existing, items) {
    const seen = new Set();
    const merged = [];
    items.concat(existing || []).forEach(item => {
      const key = item.link || item.title;
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(item);
    });
    return merged;
  }

  if (typeof NEWS_DATA !== 'undefined') {
    NEWS_DATA = prependUnique(NEWS_DATA, [
      {"title":"[인사] 농촌진흥청","link":"https://www.foodnews.co.kr/news/articleView.html?idxno=119228","description":"인사","pubDate":"2026-07-02 17:04:30","source":"foodnews"},
      {"title":"“폭염·폭우 끄떡없다”…배추 2만7000톤 확보ㆍ소규모 김치업체 지원","link":"https://www.foodnews.co.kr/news/articleView.html?idxno=119222","description":"정책","pubDate":"2026-07-02 17:00:00","source":"foodnews"},
      {"title":"[인사] 식품의약품안전처(고위공무원단)","link":"https://www.foodnews.co.kr/news/articleView.html?idxno=119227","description":"인사","pubDate":"2026-07-02 16:43:47","source":"foodnews"},
      {"title":"“K-푸드 모방품 꼼짝 마”…aT, 알리바바와 지재권 보호 세미나","link":"https://www.foodnews.co.kr/news/articleView.html?idxno=119226","description":"식품산업","pubDate":"2026-07-02 16:06:29","source":"foodnews"},
      {"title":"건강기능식품 피해 구제 도입, 사진 한 장으로 직구 식품 위해 여부 감별, 달걀 살모넬라 검사 의무화","link":"https://www.foodnews.co.kr/news/articleView.html?idxno=119221","description":"정책","pubDate":"2026-07-02 15:40:00","source":"foodnews"},
      {"title":"aT, K-푸드 온라인 수출상담회 참가사 모집","link":"https://www.foodnews.co.kr/news/articleView.html?idxno=119225","description":"식품산업","pubDate":"2026-07-02 15:37:20","source":"foodnews"},
      {"title":"식약처, 소비자 헷갈리던 건강기능식품·GMP 도안 바꾼다","link":"https://www.foodnews.co.kr/news/articleView.html?idxno=119224","description":"건강기능식품","pubDate":"2026-07-02 14:45:12","source":"foodnews"},
      {"title":"동물복지 산란계 농장 10곳 인증 취소","link":"https://www.foodnews.co.kr/news/articleView.html?idxno=119223","description":"농수축산","pubDate":"2026-07-02 14:13:21","source":"foodnews"},
      {"title":"[2026 식품과학회 학술대회] 식품산업협회, 당류 저감ㆍ비만 예방 정책 방향 논의","link":"https://www.foodnews.co.kr/news/articleView.html?idxno=119220","description":"식품산업","pubDate":"2026-07-02 13:35:00","source":"foodnews"},
      {"title":"“불면증ㆍ우울증 치료된다더니”…식약처, 위해성분 든 해외직구식품 19개 반입차단","link":"https://www.foodnews.co.kr/news/articleView.html?idxno=119210","description":"정책","pubDate":"2026-07-02 10:10:58","source":"foodnews"}
    ]);
  }

  if (typeof NEWS_YAKUP_DATA !== 'undefined') {
    NEWS_YAKUP_DATA = prependUnique(NEWS_YAKUP_DATA, [
      {"nid":"329354","title":"EU, 해외직구·혼합노출·재활용 소재 위험 경고","link":"https://www.yakup.com/news/index.html?mode=view&cat=12&nid=329354","pubDate":"2026-07-03 06:00:00","source":"yakup"},
      {"nid":"329353","title":"롱제비티, 마케팅 걷어내고 실증 경쟁으로","link":"https://www.yakup.com/news/index.html?mode=view&cat=12&nid=329353","pubDate":"2026-07-03 06:00:00","source":"yakup"},
      {"nid":"329346","title":"美 슈퍼마켓 체인업체 ‘크로거’ 16.5억弗 M&A","link":"https://www.yakup.com/news/index.html?mode=view&cat=12&nid=329346","pubDate":"2026-07-02 17:36:00","source":"yakup"}
    ]);
  }

})();
