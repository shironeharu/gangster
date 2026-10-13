const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

test('뷰어와 관리자 화면 전환 및 수정 이벤트 방어', async () => {
  const dom = new JSDOM(fs.readFileSync('index.html','utf8'), {url:'https://example.test',runScripts:'outside-only'});
  const w = dom.window;
  const calls = [];
  const ref = path => ({
    doc: id => ref(path+'/'+id), orderBy: () => ref(path),
    set: async data => { calls.push(['write',path,data]); },
    update: async data => { calls.push(['write',path,data]); },
    delete: async () => { calls.push(['delete',path]); },
    onSnapshot: cb => { calls.push(['subscribe',path]); cb({docs:[]}); return () => {}; }
  });
  w.firebaseConfig = {};
  w.firebase = {initializeApp(){},auth:()=>({currentUser:{uid:'test'},signInAnonymously:async()=>{}}),firestore:()=>({collection:ref})};
  w.eval(fs.readFileSync('app.js','utf8'));
  w.eval(fs.readFileSync('login-mode.js','utf8'));
  const el=id=>w.document.getElementById(id);
  el('viewer-password').value='family-secret';
  await el('viewer-login-btn').onclick();
  assert.equal(el('current-user').textContent,'패밀리원 · 읽기 전용');
  assert.equal(el('tab-panel-interview').classList.contains('hidden'),true);
  assert.equal(calls.some(c=>c[0]==='subscribe' && c[1]==='candidates'),false);
  w.openMemberModal({id:'one',nickname:'팸원',warnings:[{reason:'기록'}]});
  assert.equal(el('f-member-nickname').disabled,true);
  assert.equal(w.document.querySelector('.warning-remove-btn'),null);
  const before=calls.length;
  el('member-save-btn').click(); el('member-delete-btn').click(); el('save-btn').click();
  assert.equal(calls.length,before);
  await el('logout-btn').onclick();
  assert.equal(el('member-modal').classList.contains('hidden'),true);
  el('login-name').value='하루'; el('login-password').value='admin-secret';
  await el('login-btn').onclick();
  assert.equal(el('tab-panel-interview').classList.contains('hidden'),false);
  assert.equal(calls.some(c=>c[0]==='subscribe' && c[1]==='candidates'),true);
  w.openMemberModal({id:'one',nickname:'팸원',warnings:[]});
  assert.equal(el('f-member-nickname').disabled,false);
  dom.window.close();
});

test('Firebase 없이도 패밀리원·관리자 로그인 버튼이 전환된다', () => {
  const dom = new JSDOM(fs.readFileSync('index.html','utf8'), {runScripts:'outside-only'});
  const w = dom.window;
  w.eval(fs.readFileSync('login-mode.js','utf8'));
  const el = id => w.document.getElementById(id);
  assert.equal(el('viewer-mode-btn').textContent, '패밀리원 로그인');
  assert.equal(el('viewer-login-btn').textContent, '접속하기');
  el('admin-mode-btn').click();
  assert.equal(el('admin-login-form').classList.contains('hidden'), false);
  assert.equal(el('viewer-login-form').classList.contains('hidden'), true);
  assert.equal(el('admin-mode-btn').getAttribute('aria-pressed'), 'true');
  el('viewer-mode-btn').click();
  assert.equal(el('viewer-login-form').classList.contains('hidden'), false);
  assert.equal(el('admin-login-form').classList.contains('hidden'), true);
  dom.window.close();
});
