// Keep answer aliases on the server. Send only the derived hint to participants.
const aliases: Record<number, string[]> = {
  0: ['구파발', '구파발역', 'Gupabal', 'Gupabal station'],
  1: ['시흥동', '시흥', 'Siheung', 'Siheung dong'],
  2: ['고척동', '고척', 'Gocheok', 'Gocheok dong'],
  3: ['익선동', '익선', '익선동 한옥마을', 'Ikseon dong'],
  4: ['미아리고개', '미아리 눈물고개', '되너미고개', '단장의 미아리고개'],
  5: ['서울세계불꽃축제', '서울불꽃축제', '세계불꽃축제', '여의도불꽃축제', '서울국제불꽃축제', 'Seoul International Fireworks Festival'],
  6: ['한강페스티벌', '한강페스티벌 가을', '가을 한강페스티벌', 'Hangang Festival', 'Han River Festival'],
  7: ['서울국제정원박람회', '국제정원박람회', '서울정원박람회', 'Seoul International Garden Show', 'Seoul International Garden Expo'],
  8: ['서울세계도시문화축제', '세계도시문화축제', '서울세계문화축제', 'Seoul Friendship Festival'],
  9: ['차없는 잠수교 뚜벅뚜벅 축제', '잠수교 뚜벅뚜벅 축제', '뚜벅뚜벅 축제', '잠수교 축제', '잠수교 뚜벅뚜벅'],
  10: ['명동', '명동 일대', 'Myeongdong'],
  11: ['N서울타워', '남산', '남산타워', '남산서울타워', '서울타워', 'N Seoul Tower', 'Namsan Tower', 'Seoul Tower'],
  12: ['DDP', '동대문디자인플라자', '동대문디자인플라자 DDP', '디디피', 'Dongdaemun Design Plaza'],
  13: ['북한산', '북한산 국립공원', 'Bukhansan', 'Bukhansan National Park'],
  14: ['서울숲', '서울숲 공원', 'Seoul Forest'],
  15: ['건강안전도시', '건강안전'],
  16: ['동행성장도시', '동행성장'],
  17: ['주거안정도시', '주거안정'],
  18: ['기회활력도시', '기회활력'],
  19: ['공간혁신도시', '공간혁신'],
  20: ['마음핏 36.5', '마음핏', '마음핏 삼십육점오'],
  21: ['내 집 앞 10분 운세권', '10분 운세권', '내 집 앞 십분 운세권', '십분 운세권', '운세권'],
  22: ['청년 AI 사다리', 'AI 사다리', '청년 인공지능 사다리', '인공지능 사다리'],
  23: ['바로내집', '바로내집 주택'],
  24: ['자율주행버스', '자율주행 버스 500대', '무인 자율주행버스', 'Autonomous bus', 'Self driving bus'],
};
const hintAnswers = [
  '구파발', '시흥동', '고척동', '익선동', '미아리고개',
  '서울세계불꽃축제', '한강페스티벌', '서울국제정원박람회', '서울세계도시문화축제', '차없는 잠수교 뚜벅뚜벅 축제',
  '명동', '엔서울타워', '디디피', '북한산', '서울숲',
  '건강안전도시', '동행성장도시', '주거안정도시', '기회활력도시', '공간혁신도시',
  '마음핏 36.5', '내 집 앞 10분 운세권', '청년 에이아이 사다리', '바로내집', '자율주행버스',
];
export function normalizeAnswer(value: string): string {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[\s\p{P}]/gu, '')
    .replace(/^(?:2026년|2026)/, '')
    .replace(/페스티발|페스티벌|festival/g, '축제')
    .replace(/에이아이/g, 'ai')
    .replace(/디디피/g, 'ddp')
    .replace(/^엔서울타워$/, 'n서울타워');
}
export function isCorrectAnswer(q: {id: number; answer: string}, submitted: string): boolean {
  const normalized = normalizeAnswer(submitted);
  return !!normalized && [q.answer, ...(aliases[q.id] || [])].some(a => normalizeAnswer(a) === normalized);
}
export function getQuestionHint(id: number) {
  const representative = hintAnswers[id];
  if (!representative) return null;
  const characters = [...representative.replace(/[\s.]/g, '')];
  const initials = [...representative].map(char => {
    const offset = char.charCodeAt(0) - 0xac00;
    return offset >= 0 && offset < 11172 ? 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'[Math.floor(offset / 588)] : char;
  }).join('');
  return {count: characters.length, initials, note: '대표 정답 기준 · 공백·문장부호 제외 · 영문은 한글 발음 기준'};
}
