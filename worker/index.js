const CHAPTER_IDS=["fund:overview", "fund:pools", "fund:debt", "fund:equity", "fund:structure", "fund:business", "fund:strategy", "fund:latrobe", "fund:governance", "fund:risk", "fund:deployment", "fund:terms", "latrobe:opportunity", "latrobe:returns", "latrobe:model", "latrobe:revenue", "latrobe:client", "latrobe:protections", "latrobe:site", "latrobe:system", "latrobe:reduction", "latrobe:capital", "latrobe:timeline", "latrobe:invoice"];
const CHAPTER_LABELS={"fund:overview": "Fund overview / 基金概览", "fund:pools": "Two pools / 两个资金池", "fund:debt": "Debt strategy / 债权策略", "fund:equity": "Equity strategy / 股权策略", "fund:structure": "Capital structure / 投资结构", "fund:business": "Operating model / 经营模式", "fund:strategy": "Project selection / 项目选择", "fund:latrobe": "Latrobe overview / Latrobe概览", "fund:governance": "Governance / 管理及投资者范围", "fund:risk": "Risk / 风险管理", "fund:deployment": "Deployment / 部署及报告", "fund:terms": "Fund terms / 募资方案", "latrobe:opportunity": "Project overview / 项目概览", "latrobe:returns": "Project returns / 项目回报", "latrobe:model": "Project business model / 项目经营模式", "latrobe:revenue": "Revenue / 收入结构", "latrobe:client": "Customer saving / 客户优惠", "latrobe:protections": "Payment protections / 回款保障", "latrobe:site": "Site / 场地", "latrobe:system": "PV & BESS / 光储资产", "latrobe:reduction": "Retail simulation / 零售账单模拟", "latrobe:capital": "Project budget / 项目预算", "latrobe:timeline": "Project timeline / 交付计划", "latrobe:invoice": "Invoice evidence / 账单证据"};


const encoder = new TextEncoder();
const SECURE_HEADERS = {'cache-control':'no-store, private','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'same-origin','permissions-policy':'camera=(), microphone=(), geolocation=()','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"};
function response(body,status=200,type='text/html; charset=utf-8',headers={}){return new Response(body,{status,headers:{...SECURE_HEADERS,'content-type':type,...headers}});}
function json(data,status=200){return response(JSON.stringify(data),status,'application/json; charset=utf-8');}
function redirect(path,cookie){return response('',303,'text/plain',{'location':path,...(cookie?{'set-cookie':cookie}:{})});}
function base64url(bytes){let result='';for(const x of new Uint8Array(bytes))result+=String.fromCharCode(x);return btoa(result).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
function decode64(value){const normalized=value.replaceAll('-','+').replaceAll('_','/');return Uint8Array.from(atob(normalized+'='.repeat((4-normalized.length%4)%4)),c=>c.charCodeAt(0));}
async function digest(value){return new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)));}
function equal(a,b){if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a[i]^b[i];return n===0;}
async function secretMatches(a,b){return equal(await digest(a),await digest(b));}
async function signingKey(env){return crypto.subtle.importKey('raw',encoder.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function token(data,env){const payload=base64url(encoder.encode(JSON.stringify(data)));const signature=await crypto.subtle.sign('HMAC',await signingKey(env),encoder.encode(payload));return payload+'.'+base64url(signature);}
async function readSession(request,env){try{const match=(request.headers.get('cookie')||'').match(/(?:^|;\s*)__Host-e3=([^;]+)/);if(!match)return null;const [payload,signature,extra]=match[1].split('.');if(extra||!payload||!signature)return null;if(!await crypto.subtle.verify('HMAC',await signingKey(env),decode64(signature),encoder.encode(payload)))return null;const result=JSON.parse(new TextDecoder().decode(decode64(payload)));if(result.exp<Date.now()||!['viewer','admin'].includes(result.role)||typeof result.visitId!=='string')return null;return result;}catch{return null;}}
function cookie(value,age=14400){return '__Host-e3='+value+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+age;}
function sameOrigin(request){const origin=request.headers.get('origin');return origin!==null&&origin===new URL(request.url).origin;}
function isConfigured(env){return !!(env.DB&&env.VIEWER_PASSWORD&&env.ADMIN_PASSWORD&&env.SESSION_SECRET?.length>=32&&env.VIEWER_PASSWORD!==env.ADMIN_PASSWORD);}
function clean(value,max){return typeof value==='string'?value.trim().slice(0,max).replace(/[\u0000-\u001f\u007f]/g,''):'';}
async function auditRows(env,limit,offset){return (await env.DB.prepare("SELECT v.*, (SELECT group_concat(chapter, ', ') FROM (SELECT DISTINCT chapter FROM events WHERE visit_id=v.id AND event='chapter')) AS chapters FROM visits v WHERE role='viewer' ORDER BY started_at DESC LIMIT ? OFFSET ?").bind(limit,offset).all()).results;}
function csvCell(value){let text=String(value??'');if(/^[\s]*[=+\-@]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export default {
 async fetch(request,env,ctx){
  try{
   const url=new URL(request.url);const path=url.pathname;
   if(path==='/health')return json({ok:isConfigured(env)},isConfigured(env)?200:503);
   if(!isConfigured(env))return response('Service is not configured. / 服务尚未配置。',503,'text/plain; charset=utf-8');
   if(path==='/logout')return redirect('/',cookie('',0));
   if(path==='/api/login'){
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    if(!sameOrigin(request))return json({error:'Invalid origin'},403);
    if(Number(request.headers.get('content-length')||0)>8192)return json({error:'Request too large'},413);
    const text=await request.text();if(text.length>8192)return json({error:'Request too large'},413);
    const form=new URLSearchParams(text);const role=form.get('role')==='admin'?'admin':'viewer';const name=clean(form.get('name'),100),email=clean(form.get('email'),254).toLowerCase(),organization=clean(form.get('organization'),160),password=form.get('password')||'';
    const target=role==='admin'?'/admin':(form.get('returnTo')==='/projects/latrobe'?'/projects/latrobe':'/');
     const ip=clean(request.headers.get('cf-connecting-ipv6')||request.headers.get('cf-connecting-ip'),64)||'unknown';const key=base64url(await digest(ip+':'+role+':'+env.SESSION_SECRET));const now=Date.now();
    const attempts=await env.DB.prepare('SELECT count(*) AS count FROM attempts WHERE key=? AND created_at>?').bind(key,now-900000).first();
    if(attempts.count>=8)return response('Too many failed attempts. Try again in 15 minutes. / 错误次数过多，请15分钟后再试。',429,'text/plain; charset=utf-8',{'retry-after':'900'});
     if(!name||password.length>200||!await secretMatches(password,role==='admin'?env.ADMIN_PASSWORD:env.VIEWER_PASSWORD)){
     await env.DB.prepare('INSERT INTO attempts (key,created_at) VALUES (?,?)').bind(key,now).run();return redirect(target+'?error=1');
    }
     const visitId=crypto.randomUUID();const iso=new Date().toISOString();const cf=request.cf||{};
     await env.DB.batch([
      env.DB.prepare('DELETE FROM attempts WHERE created_at<?').bind(now-900000),
      env.DB.prepare('INSERT INTO visits (id,email,name,organization,role,started_at,last_seen_at,active_seconds,ip_address,country,region,city,timezone,notification_status) VALUES (?,?,?,?,?,?,?,0,?,?,?,?,?,?)').bind(visitId,email,name,organization,role,iso,iso,ip,clean(cf.country,8),clean(cf.region,160),clean(cf.city,160),clean(cf.timezone,100),role==='viewer'?'pending':'not_requested')
     ]);
    const session=await token({visitId,role,exp:now+14400000},env);
    if(role==='viewer'){
     const notification=notifyLogin(env,{id:visitId,name,started_at:iso,ip_address:ip,country:clean(cf.country,8),region:clean(cf.region,160),city:clean(cf.city,160),timezone:clean(cf.timezone,100)});
     if(ctx?.waitUntil)ctx.waitUntil(notification);else await notification;
    }
    return redirect(target,cookie(session));
   }
   const session=await readSession(request,env);
   if(path==='/api/me'){if(request.method!=='GET')return json({error:'Method not allowed'},405);if(!session)return json({error:'Authentication required'},401);const me=await env.DB.prepare('SELECT name FROM visits WHERE id=?').bind(session.visitId).first();return me?json({name:me.name}):json({error:'Invalid visit'},401);}
   if(path==='/admin')return response(session?.role==='admin'?ADMIN_PAGE:(url.searchParams.has('error')?ADMIN_GATE_ERROR:ADMIN_GATE));
   if(path.startsWith('/api/logs')){
    if(!session)return json({error:'Authentication required'},401);if(session.role!=='admin')return json({error:'Administrator required'},403);if(request.method!=='GET')return json({error:'Method not allowed'},405);
    if(path==='/api/logs.csv'){
     const rows=await auditRows(env,20000,0);const fields=['id','name','ip_address','country','region','city','timezone','started_at','last_seen_at','active_seconds','chapters','notification_status','notification_error'];const header=['Session ID','Self-declared name','IP address','Country code','Region (approximate)','City (approximate)','Visitor timezone','Started UTC','Last seen UTC','Visible seconds estimate','Chapters','Email notification status','Email notification error'];const csv='\uFEFF'+[header.map(csvCell).join(','),...rows.map(r=>fields.map(f=>csvCell(f==='chapters'?String(r[f]||'').split(', ').map(x=>CHAPTER_LABELS[x]||x).join(' · '):r[f])).join(','))].join('\r\n');return response(csv,200,'text/csv; charset=utf-8',{'content-disposition':'attachment; filename="e3-investment-visitors.csv"'});
    }
    if(path!=='/api/logs')return json({error:'Not found'},404);
     const offset=Math.max(0,Math.min(100000,parseInt(url.searchParams.get('offset')||'0',10)||0));const [rows,stats]=await Promise.all([auditRows(env,100,offset),env.DB.prepare("SELECT count(*) AS total,count(DISTINCT name) AS unique_count FROM visits WHERE role='viewer'").first()]);return json({rows,total:stats.total,unique:stats.unique_count,hasMore:offset+rows.length<stats.total});
   }
   if(path==='/api/event'){
    if(request.method!=='POST')return json({error:'Method not allowed'},405);if(!sameOrigin(request))return json({error:'Invalid origin'},403);if(!session)return json({error:'Authentication required'},401);if(session.role==='admin')return json({ok:true});
    const text=await request.text();if(text.length>1000)return json({error:'Request too large'},413);let data;try{data=JSON.parse(text);}catch{return json({error:'Invalid JSON'},400);}
    if(!CHAPTER_IDS.includes(data.chapter)||!['chapter','heartbeat'].includes(data.event))return json({error:'Invalid event'},400);
    const visit=await env.DB.prepare('SELECT last_seen_at FROM visits WHERE id=?').bind(session.visitId).first();if(!visit)return json({error:'Invalid visit'},401);const now=Date.now(),elapsed=Math.max(0,(now-Date.parse(visit.last_seen_at))/1000);if(elapsed<2&&data.event==='heartbeat')return json({ok:true});const increment=data.event==='heartbeat'&&elapsed<=45?Math.floor(elapsed):0;const iso=new Date(now).toISOString();const queries=[env.DB.prepare('UPDATE visits SET last_seen_at=?, active_seconds=active_seconds+? WHERE id=?').bind(iso,increment,session.visitId)];if(data.event==='chapter')queries.push(env.DB.prepare('INSERT OR IGNORE INTO events (id,visit_id,chapter,event,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),session.visitId,data.chapter,data.event,iso));await env.DB.batch(queries);return json({ok:true});
   }
   if(!session){if(path.startsWith('/asset/'))return response('Authentication required',401,'text/plain');if(!['/','/projects/latrobe'].includes(path))return json({error:'Not found'},404);let gate=url.searchParams.has('error')?GATE_ERROR:GATE;if(path==='/projects/latrobe')gate=gate.replace('</form>','<input type="hidden" name="returnTo" value="/projects/latrobe"></form>');return response(gate);}
   if(request.method!=='GET'&&request.method!=='HEAD')return json({error:'Method not allowed'},405);
   if(path==='/')return response(FUND_PAGE);
   if(path==='/projects/latrobe')return response(REPORT);
   if(path==='/asset/invoice')return response(EVIDENCE);
   if(path.startsWith('/asset/')){const asset=ASSETS[path.slice(7)];if(!asset)return response('Not found',404,'text/plain');const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));return response(request.method==='HEAD'?null:bytes,200,asset.type);}
   return response('Not found',404,'text/plain');
  }catch(error){console.error('E3 request failed:',error?.message||'Unknown error');return response('The service is temporarily unavailable. Please try again. / 服务暂时不可用，请稍后重试。',503,'text/plain; charset=utf-8');}
 }
};
