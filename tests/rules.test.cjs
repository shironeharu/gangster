const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc } = require('firebase/firestore');

test('뷰어 조회 전용, 관리자 권한, 비밀번호 변경 및 로그아웃', async () => {
  const env = await initializeTestEnvironment({projectId:'demo-gangster', firestore:{rules:readFileSync('firestore.rules','utf8')}});
  try {
    await env.withSecurityRulesDisabled(async c => {
      const db = c.firestore();
      await setDoc(doc(db,'admins/하루'), {password:'admin-secret'});
      await setDoc(doc(db,'admins/윙윙'), {password:'former-secret'});
      await setDoc(doc(db,'accessSessions/former'), {role:'admin',name:'윙윙',password:'former-secret'});
      await setDoc(doc(db,'settings/viewerAccess'), {password:'family-secret'});
      await setDoc(doc(db,'members/member'), {nickname:'테스트'});
      await setDoc(doc(db,'candidates/candidate'), {nickname:'면접자'});
    });
    const viewer = env.authenticatedContext('viewer').firestore();
    const admin = env.authenticatedContext('admin').firestore();
    const guest = env.unauthenticatedContext().firestore();
    const former = env.authenticatedContext('former').firestore();
    await assertFails(getDocs(collection(former,'candidates')));
    await assertFails(updateDoc(doc(former,'members/member'), {nickname:'탈퇴자 수정'}));
    await assertFails(setDoc(doc(former,'accessSessions/former'), {role:'admin',name:'윙윙',password:'former-secret'}));
    await assertFails(getDoc(doc(guest,'members/member')));
    await assertFails(getDocs(collection(viewer,'members')));
    await assertFails(setDoc(doc(viewer,'accessSessions/viewer'), {role:'viewer',name:'',password:'wrong'}));
    await assertSucceeds(setDoc(doc(viewer,'accessSessions/viewer'), {role:'viewer',name:'',password:'family-secret'}));
    await assertSucceeds(getDocs(collection(viewer,'members')));
    await assertFails(setDoc(doc(viewer,'members/new'), {nickname:'추가'}));
    await assertFails(updateDoc(doc(viewer,'members/member'), {nickname:'변경'}));
    await assertFails(deleteDoc(doc(viewer,'members/member')));
    await assertFails(getDocs(collection(viewer,'candidates')));
    await assertFails(getDocs(collection(viewer,'admins')));
    await assertFails(getDoc(doc(viewer,'settings/viewerAccess')));
    await assertFails(getDoc(doc(viewer,'accessSessions/viewer')));
    await assertFails(setDoc(doc(viewer,'settings/viewerAccess'), {password:'hijacked'}));
    await assertFails(setDoc(doc(viewer,'accessSessions/admin'), {role:'viewer',name:'',password:'family-secret'}));
    await assertFails(setDoc(doc(viewer,'accessSessions/viewer'), {role:'admin',name:'하루',password:'family-secret'}));
    await assertSucceeds(setDoc(doc(admin,'accessSessions/admin'), {role:'admin',name:'하루',password:'admin-secret'}));
    await assertSucceeds(getDocs(collection(admin,'candidates')));
    await assertSucceeds(updateDoc(doc(admin,'members/member'), {nickname:'관리자 수정'}));
    await assertSucceeds(setDoc(doc(admin,'settings/viewerAccess'), {password:'new-family-secret'}));
    await assertFails(getDocs(collection(viewer,'members')));
    await assertSucceeds(setDoc(doc(viewer,'accessSessions/viewer'), {role:'viewer',name:'',password:'new-family-secret'}));
    await assertSucceeds(getDocs(collection(viewer,'members')));
    await assertSucceeds(deleteDoc(doc(viewer,'accessSessions/viewer')));
    await assertFails(getDocs(collection(viewer,'members')));
  } finally { await env.cleanup(); }
});
