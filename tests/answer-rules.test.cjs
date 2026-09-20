const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
function load(path) {
  const module = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText)(module, module.exports);
  return module.exports;
}
const {questions} = load('lib/questions.ts');
const {isCorrectAnswer, getQuestionHint} = load('lib/answer-rules.ts');
test('all 25 canonical answers match, and every question has an incomplete hint', () => {
  for (const q of questions) {
    assert.equal(isCorrectAnswer(q, q.answer), true, q.answer);
    const h = getQuestionHint(q.id);
    assert.ok(h.count > 0 && h.initials);
    assert.equal(/[가-힣a-z]/i.test(h.initials), false, h.initials);
  }
  assert.deepEqual([getQuestionHint(12).count, getQuestionHint(12).initials], [3, 'ㄷㄷㅍ']);
  assert.deepEqual([getQuestionHint(22).count, getQuestionHint(22).initials], [9, 'ㅊㄴ ㅇㅇㅇㅇ ㅅㄷㄹ']);
});
test('accept Korean pronunciation, English names, festival synonyms and year omission', () => {
  for (const [id, answer] of [[1,'시흥'],[2,'고척'],[5,'서울 세계 불꽃 페스티벌'],[5,'Seoul International Fireworks Festival'],[6,'2026년 한강 축제'],[6,'한강 페스티발'],[8,'서울세계도시문화페스티벌'],[9,'뚜벅뚜벅 페스티벌'],[11,'엔서울타워'],[11,'N Seoul Tower'],[12,'디디피'],[12,'ｄｄｐ'],[12,'Dongdaemun Design Plaza'],[14,'Seoul Forest'],[20,'마음핏 삼십육점오'],[21,'십분 운세권'],[22,'청년 에이아이 사다리'],[22,'청년 인공지능 사다리']]) {
    assert.equal(isCorrectAnswer(questions[id], answer), true, `${id}: ${answer}`);
  }
});
test('reject vague fragments, another event and wrong policy names', () => {
  for (const [id, answer] of [[5,'축제'],[5,'한강축제'],[6,'서울세계불꽃축제'],[11,'타워'],[12,'동대문'],[15,'도시'],[17,'주거불안도시'],[20,'마음핏 99.9'],[22,'AI'],[24,'버스'],[1,'']]) {
    assert.equal(isCorrectAnswer(questions[id], answer), false, `${id}: ${answer}`);
  }
});
