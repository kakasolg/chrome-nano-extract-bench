// Fixture source articles. Everything here is fictional: companies, tickers,
// people, numbers, outlets. Each article exists in two languages with the same
// facts so that language is an isolated variable.
//
// Ground truth per article is declared once here and copied into labels.json
// by generate.mjs. Fields marked "distractor" exist to test a specific failure:
//   - distractor_percent: a percentage in the body that is NOT the price change
//     (an inflation print, a rate). The extraction must not put it into
//     change_percent.
//   - subheading: a short standalone line under the headline that a model can
//     copy verbatim instead of writing its own headline. Variants toggle it.
//   - price panel: a quote box (ticker, price, change) rendered above the body.
//     Variants toggle it; when absent, price/change_percent ground truth is null.

export const ARTICLES = [
  {
    id: "metals",
    en: {
      outlet: "Northgate Wire",
      byline: "By Ingrid Solberg",
      date_display: "March 14, 2026 4:12 PM",
      headline: "Halvorsen Metals slides as copper demand outlook dims",
      subheading: "Analysts trim targets after weak factory data",
      body: [
        "OSLO, March 14 — Shares of Halvorsen Metals fell on Friday after the company cut its full-year shipment forecast, citing softer demand from Asian manufacturers.",
        "The miner now expects to ship between 410,000 and 430,000 tonnes of refined copper this year, down from an earlier range of 450,000 to 470,000 tonnes.",
        "The revision came a day after a regional factory survey showed activity contracting for a third straight month. Separately, consumer prices in the region rose 3.4% from a year earlier in February, above the central bank's target.",
        "\"The order book is thinner than we assumed in January,\" chief executive Marit Eklund told analysts on a call. \"We are not seeing the restocking cycle that usually follows a slow fourth quarter.\"",
        "Two brokerages lowered their price targets on the stock following the call, while one kept a buy rating, arguing the pullback was overdone.",
      ],
    },
    ko: {
      outlet: "노스게이트 와이어",
      byline: "잉그리드 솔베르그 기자",
      date_display: "2026년 3월 14일 오후 4:12",
      headline: "할보르센 메탈스, 구리 수요 전망 악화에 하락",
      subheading: "부진한 공장 지표에 애널리스트들 목표가 하향",
      body: [
        "오슬로, 3월 14일 — 할보르센 메탈스 주가가 금요일 하락했다. 회사가 아시아 제조업체의 수요 둔화를 이유로 연간 출하 전망을 낮춘 데 따른 것이다.",
        "회사는 올해 정련 구리 출하량을 41만~43만 톤으로 예상했다. 종전 전망치인 45만~47만 톤에서 낮춘 것이다.",
        "이번 하향은 지역 공장 경기 조사가 3개월 연속 위축을 보인 다음 날 나왔다. 별도로 이 지역의 2월 소비자물가는 전년 대비 3.4% 올라 중앙은행 목표를 웃돌았다.",
        "마리트 에클룬드 최고경영자는 애널리스트 대상 콜에서 \"수주 잔량이 1월에 가정했던 것보다 얇다\"며 \"부진한 4분기 뒤에 보통 오는 재고 보충 사이클이 보이지 않는다\"고 말했다.",
        "콜 이후 두 증권사가 목표 주가를 낮췄고, 한 곳은 하락이 과도하다며 매수 의견을 유지했다.",
      ],
    },
    quote: { ticker: "HVM", exchange: "OSE", price: 187.4, change_percent: -4.6, currency: "NOK" },
    truth: {
      published_at: "2026-03-14",
      instrument: "HVM",
      distractor_percent: 3.4,
      sentiment: "negative",
      topic: "copper miner cuts shipment forecast",
      // A headline is "on topic" if it names the company or the commodity.
      keywords: { en: ["halvorsen", "copper"], ko: ["할보르센", "구리"] },
    },
  },
  {
    id: "battery",
    en: {
      outlet: "Southbank Daily",
      byline: "By Tomas Reyes",
      date_display: "May 2, 2026 9:48 AM",
      headline: "Larkspur Energy jumps on grid storage contract win",
      subheading: "Utility deal is the company's largest to date",
      body: [
        "LISBON, May 2 — Larkspur Energy rose sharply on Thursday after it said a European utility had selected the company to supply 1.2 gigawatt-hours of battery storage over three years.",
        "The contract, valued at roughly €640 million, is the largest in Larkspur's history and more than doubles its order backlog, the company said in a statement.",
        "The announcement landed on the same morning that the regional central bank held its benchmark rate at 2.75%, as widely expected, and said inflation was moving back toward target.",
        "\"Storage is no longer a pilot business for us,\" chief executive Ana Ferreira said. \"This order lets us commit to the second production line we have been planning since last year.\"",
        "Shares of two smaller storage suppliers also gained on the news, though one analyst cautioned that margins on utility-scale contracts remain thin.",
      ],
    },
    ko: {
      outlet: "사우스뱅크 데일리",
      byline: "토마스 레예스 기자",
      date_display: "2026년 5월 2일 오전 9:48",
      headline: "라크스퍼 에너지, 전력망 저장장치 계약 수주에 급등",
      subheading: "유틸리티 계약은 회사 사상 최대 규모",
      body: [
        "리스본, 5월 2일 — 라크스퍼 에너지가 목요일 급등했다. 유럽의 한 유틸리티가 3년간 1.2기가와트시 규모 배터리 저장장치 공급사로 회사를 선정했다고 밝힌 데 따른 것이다.",
        "회사는 성명에서 약 6억4천만 유로 규모의 이 계약이 창사 이래 최대이며 수주 잔량을 두 배 이상 늘린다고 밝혔다.",
        "발표는 지역 중앙은행이 예상대로 기준금리를 2.75%로 동결하고 물가가 목표를 향해 되돌아가고 있다고 밝힌 같은 날 아침에 나왔다.",
        "아나 페레이라 최고경영자는 \"저장장치는 더 이상 시범 사업이 아니다\"라며 \"이번 수주로 지난해부터 계획해 온 두 번째 생산 라인에 착수할 수 있게 됐다\"고 말했다.",
        "소규모 저장장치 공급사 두 곳의 주가도 이 소식에 올랐지만, 한 애널리스트는 유틸리티 규모 계약의 마진이 여전히 얇다고 경계했다.",
      ],
    },
    quote: { ticker: "LKSP", exchange: "EUR", price: 42.15, change_percent: 11.8, currency: "EUR" },
    truth: {
      published_at: "2026-05-02",
      instrument: "LKSP",
      distractor_percent: 2.75,
      sentiment: "positive",
      topic: "battery storage maker wins utility contract",
      keywords: { en: ["larkspur", "storage", "battery"], ko: ["라크스퍼", "저장장치", "배터리"] },
    },
  },
];

// Binary variables. Every article is rendered in every combination.
export const VARIANTS = {
  lang: ["en", "ko"],
  panel: [true, false],      // price quote box above the body
  subheading: [true, false], // copyable one-line deck under the headline
};
