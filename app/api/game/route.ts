import { database } from '@/lib/server-db';
import { questions } from '@/lib/questions';
import { isCorrectAnswer, getQuestionHint } from '@/lib/answer-rules';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
// Sites that proxy to this worker (see vercel.json); their Origin differs from req.url.
const proxyOrigins=['https://seoul-quiz-zoom.vercel.app'];
const clean=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[\s·.,()\-]/g,'');

async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
async function room(db:D1Database,code:string){return db.prepare('SELECT * FROM rooms WHERE code=?').bind(code).first<any>();}
function error(message:string,status=400){throw Object.assign(new Error(message),{status});}
async function reconcileSiheung(db:D1Database,code:string){
 const old=(await db.prepare('SELECT id,answer,points FROM answers WHERE room=? AND qid=1 AND grading_version=0').bind(code).all<any>()).results;
 if(old.length)await db.batch(old.map(a=>db.prepare('UPDATE answers SET points=?,grading_version=1 WHERE id=? AND grading_version=0').bind(clean(a.answer)==='시흥'?questions[1].points:a.points,a.id)));
}
async function snapshot(db:D1Database,r:any,token:string){
 await reconcileSiheung(db,r.code);
 const h=await hash(token);const host=!!token&&h===r.host;
 const me=token?await db.prepare('SELECT id,name,team FROM players WHERE room=? AND token=?').bind(r.code,h).first<any>():null;
 const people=(await db.prepare('SELECT p.id,p.name,p.team,COALESCE(SUM(CASE WHEN t.revealed=1 THEN a.points ELSE 0 END),0) AS score FROM players p LEFT JOIN answers a ON a.player=p.id LEFT JOIN rounds t ON t.room=a.room AND t.qid=a.qid WHERE p.room=? GROUP BY p.id ORDER BY score DESC,p.name').bind(r.code).all()).results;
 const played=(await db.prepare('SELECT qid,revealed FROM rounds WHERE room=?').bind(r.code).all()).results;
 const q=r.current==null?null:questions[r.current];
 const responses=q?(await db.prepare('SELECT a.id,a.player,a.answer,a.points,p.name,p.team FROM answers a JOIN players p ON p.id=a.player WHERE a.room=? AND a.qid=?').bind(r.code,r.current).all()).results:[];
 const myAnswer=me?responses.find((a:any)=>a.player===me.id):null;
 return {code:r.code,teams:r.teams,seconds:r.seconds,phase:r.phase,current:r.current,deadline:r.deadline,serverTime:Date.now(),host,me,people,played,submitted:responses.length,myAnswer:myAnswer?{answer:myAnswer.answer,points:myAnswer.points}:null,question:q?{id:q.id,category:q.category,points:q.points,question:q.question,hint:getQuestionHint(q.id),...(r.phase==='revealed'||r.phase==='finished'?{answer:q.answer,source:q.source}:{})}:null,responses:host&&(r.phase==='revealed'||r.phase==='finished')?responses:[],board:questions.map(q=>({id:q.id,category:q.category,points:q.points}))};
}
export async function GET(req:Request){try{const u=new URL(req.url);const code=u.searchParams.get('room')||'';const db=database();const r=await room(db,code);if(!r)return json({error:'입장코드를 확인해 주세요.'},404);return json(await snapshot(db,r,req.headers.get('Authorization')?.replace('Bearer ','')||''));}catch(e:any){console.error(e);return json({error:'연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'},503);}}
export async function POST(req:Request){try{
 const origin=req.headers.get('Origin');if(origin&&origin!==new URL(req.url).origin&&!proxyOrigins.includes(origin))return json({error:'허용되지 않은 요청입니다.'},403);
 const b=await req.json() as any;const db=database();const action=b.action;const token=req.headers.get('Authorization')?.replace('Bearer ','')||'';const hashed=await hash(token);
 if(action==='create'){
  const teams=Number(b.teams),seconds=50;if(!Number.isInteger(teams)||teams<1||teams>10||![50].includes(seconds))error('조 수와 제한시간을 확인해 주세요.');
  const code=Array.from(crypto.getRandomValues(new Uint8Array(6))).map(x=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x%31]).join('');const host=crypto.randomUUID()+crypto.randomUUID();
  await db.prepare('INSERT INTO rooms(code,host,teams,seconds,created) VALUES(?,?,?,?,?)').bind(code,await hash(host),teams,seconds,Date.now()).run();return json({code,token:host});
 }
 const r=await room(db,String(b.room||'').toUpperCase());if(!r)error('입장코드를 확인해 주세요.',404);
 if(action==='join'){
  if(r.phase==='finished')error('종료된 게임입니다. 진행자에게 새 게임의 QR코드를 요청해 주세요.');
  const name=String(b.name||'').trim().normalize('NFKC');const team=Number(b.team);if(name.length<1||name.length>20||!Number.isInteger(team)||team<1||team>r.teams)error('조와 이름(1~20자)을 확인해 주세요.');
  const ptoken=crypto.randomUUID()+crypto.randomUUID();try{const res=await db.prepare("INSERT INTO players(id,room,token,name,team) SELECT ?,?,?,?,? FROM rooms WHERE code=? AND phase IN ('lobby','board','active','revealed')").bind(crypto.randomUUID(),r.code,await hash(ptoken),name,team,r.code).run();if(!res.meta.changes)error('입장이 마감되었습니다.');}catch(e:any){if(String(e).includes('UNIQUE'))error('같은 조에 같은 이름이 있습니다. 이름 뒤에 구분자를 붙여 주세요.');throw e;}return json({code:r.code,token:ptoken});
 }
 if(action==='answer'){
  const p=await db.prepare('SELECT id FROM players WHERE room=? AND token=?').bind(r.code,hashed).first<any>();if(!p)error('참가자 입장이 필요합니다.',403);
  const q=questions[Number(b.qid)];const answer=String(b.answer||'').trim();if(!q||!answer||answer.length>120)error('답을 1~120자로 입력해 주세요.');const correct=isCorrectAnswer(q,answer);
  const res=await db.prepare("INSERT OR IGNORE INTO answers(id,room,qid,player,answer,points,created,grading_version) SELECT ?,?,?,?,?,?,?,1 FROM rooms WHERE code=? AND phase='active' AND current=? AND deadline>?").bind(crypto.randomUUID(),r.code,q.id,p.id,answer,correct?q.points:0,Date.now(),r.code,q.id,Date.now()).run();if(!res.meta.changes)error('이미 제출했거나 제출 시간이 끝났습니다.');
 }else{
  if(!token||hashed!==r.host)error('진행자 권한이 필요합니다.',403);
  if(action==='start'){const count=await db.prepare('SELECT COUNT(*) AS n FROM players WHERE room=?').bind(r.code).first<any>();if(!count.n)error('참가자가 입장한 후 시작해 주세요.');await db.prepare("UPDATE rooms SET phase='board' WHERE code=? AND phase='lobby'").bind(r.code).run();}
  else if(action==='select'){
   const q=questions[Number(b.qid)];if(!q)error('문제를 선택해 주세요.');const done=await db.prepare('SELECT id FROM rounds WHERE room=? AND qid=?').bind(r.code,q.id).first();if(done)error('이미 진행한 문제입니다.');
   const result=await db.batch([db.prepare("UPDATE rooms SET phase='active',current=?,deadline=?,seconds=50 WHERE code=? AND phase='board'").bind(q.id,Date.now()+50*1000,r.code),db.prepare("INSERT OR IGNORE INTO rounds(id,room,qid) SELECT ?,?,? FROM rooms WHERE code=? AND phase='active' AND current=?").bind(crypto.randomUUID(),r.code,q.id,r.code,q.id)]);if(!result[0].meta.changes)error('현재 문제를 마친 후 선택해 주세요.');
  }else if(action==='reveal'){
   await db.batch([db.prepare("UPDATE rooms SET phase='revealed' WHERE code=? AND phase='active'").bind(r.code),db.prepare("UPDATE rounds SET revealed=1 WHERE room=? AND qid=(SELECT current FROM rooms WHERE code=? AND phase='revealed')").bind(r.code,r.code)]);
  }else if(action==='next'){await db.prepare("UPDATE rooms SET phase='board',current=NULL,deadline=NULL WHERE code=? AND phase='revealed'").bind(r.code).run();}
  else if(action==='finish'){if(!['board','revealed'].includes(r.phase))error('현재 문제를 마친 후 종료해 주세요.');await db.prepare("UPDATE rooms SET phase='finished' WHERE code=? AND phase IN ('board','revealed')").bind(r.code).run();}
  else if(action==='grade'){
   if(!['revealed','finished'].includes(r.phase))error('정답 공개 후 수정할 수 있습니다.');const q=questions[r.current];if(!q)error('현재 문제가 없습니다.');await db.prepare('UPDATE answers SET points=?,grading_version=1 WHERE id=? AND room=? AND qid=?').bind(b.correct?q.points:0,b.answerId,r.code,r.current).run();
  }else if(action==='export'){
   await reconcileSiheung(db,r.code);
   const rows=(await db.prepare('SELECT p.team,p.name,a.qid,a.answer,a.points FROM answers a JOIN players p ON p.id=a.player JOIN rounds r ON r.room=a.room AND r.qid=a.qid WHERE a.room=? AND r.revealed=1 ORDER BY p.team,p.name,a.qid').bind(r.code).all()).results;return json({rows});
  }else error('알 수 없는 요청입니다.');
 }
 return json(await snapshot(db,await room(db,r.code),token));
 }catch(e:any){console.error(e);return json({error:e.status?e.message:'저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'},e.status||503);}}
