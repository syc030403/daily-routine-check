// 동기화: 로그인하면 날짜별 문서와 기본 루틴 문서를 Firestore에 두고 기기끼리 맞춤.
// 로그인은 선택이라, 여기서 무엇이 실패해도 이 기기 저장으로 앱은 계속 동작함
import { SDK_URL, firebaseConfig } from "./config.js";
import { todayKey } from "./dates.js";
import { flushMemo } from "./dayView.js";
import {
  STORAGE_KEY,
  createDefaultEntry,
  data,
  dateKeys,
  getEntry,
  saveData,
  saveLocalOnly,
  setSaveListener
} from "./store.js";

const SYNC_UID_KEY = "routine-sync-uid";
const DEFAULTS_DOC = "defaults";

const accountText = document.getElementById("accountText");
const accountBtn = document.getElementById("accountBtn");

let fs = null;          // Firestore SDK 함수 묶음
let db = null;
let stopListening = [];
let syncedJson = {};    // 서버와 맞춰진 내용. 바뀐 문서만 쓰고, 내가 쓴 내용의 되돌아옴을 무시하는 데 씀
// 로그인 전에는 null이라 pushChanges가 아무것도 안 함
let userPath = null;
// 다른 기기 변경이 도착했을 때 화면을 다시 그리는 함수. main.js가 넘겨줌
let renderAll = () => {};

function setAccountText(text) {
  accountText.textContent = text;
}

function readSyncUid() {
  try { return localStorage.getItem(SYNC_UID_KEY); } catch (e) { return null; }
}

function writeSyncUid(uid) {
  try { localStorage.setItem(SYNC_UID_KEY, uid); } catch (e) { /* 다음 로그인 때 다시 합침 */ }
}

function defaultsJson() {
  return JSON.stringify({ items: data.items, subItems: data.subItems, routineDates: data.routineDates });
}

// 앱을 연 것만으로 자동 생성된 기록. 올리면 다른 기기에서 체크한 내용을 빈 기록으로 덮어쓰게 됨
function isUntouched(dateKey) {
  return JSON.stringify(data[dateKey]) === JSON.stringify(createDefaultEntry(dateKey));
}

function writeDoc(ref, json) {
  fs.setDoc(ref, { value: json, updatedAt: fs.serverTimestamp() }).catch(() => {
    setAccountText("동기화 저장에 실패했어요");
  });
}

// 값은 JSON 문자열로 저장: Firestore는 맵 키를 정렬해 돌려줘서, 객체로 저장하면 루틴 순서가 뒤섞임
function pushChanges() {
  if (!userPath) return;
  dateKeys().forEach((key) => {
    const json = JSON.stringify(data[key]);
    if (syncedJson[key] === json) return;
    if (!(key in syncedJson) && isUntouched(key)) return;
    syncedJson[key] = json;
    writeDoc(fs.doc(db, userPath, "days", key), json);
  });
  const json = defaultsJson();
  if (syncedJson[DEFAULTS_DOC] !== json) {
    syncedJson[DEFAULTS_DOC] = json;
    writeDoc(fs.doc(db, userPath, "meta", DEFAULTS_DOC), json);
  }
}

function applyRemoteDefaults(json) {
  if (syncedJson[DEFAULTS_DOC] === json) return false;
  // 자동 생성된 오늘 기록은 예전 기본 루틴으로 만들어졌으니 새 기본 루틴으로 다시 만듦
  const rebuildToday = !(todayKey in syncedJson) && data[todayKey] && isUntouched(todayKey);
  const remote = JSON.parse(json);
  data.items = remote.items;
  data.subItems = remote.subItems;
  data.routineDates = remote.routineDates || {};
  syncedJson[DEFAULTS_DOC] = json;
  if (rebuildToday) data[todayKey] = createDefaultEntry(todayKey);
  return true;
}

function applyRemoteDay(key, json) {
  if (syncedJson[key] === json) return false;
  data[key] = JSON.parse(json);
  syncedJson[key] = json;
  return true;
}

// 기기에 있던 기록과 계정 기록이 같은 날짜에 둘 다 있으면 어느 쪽도 잃지 않게 합침
function mergeEntry(local, remote) {
  const merged = JSON.parse(JSON.stringify(remote));
  if (!merged.checks) merged.checks = {};
  if (!merged.subs) merged.subs = {};
  Object.keys(local.checks || {}).forEach((item) => {
    merged.checks[item] = !!merged.checks[item] || !!local.checks[item];
  });
  Object.keys(local.subs || {}).forEach((item) => {
    if (!merged.subs[item]) merged.subs[item] = {};
    Object.keys(local.subs[item]).forEach((sub) => {
      merged.subs[item][sub] = !!merged.subs[item][sub] || !!local.subs[item][sub];
    });
  });
  Object.keys(local.plans || {}).forEach((plan) => {
    if (!merged.plans) merged.plans = {};
    merged.plans[plan] = !!merged.plans[plan] || !!local.plans[plan];
  });
  if (local.memo && local.memo !== merged.memo) {
    merged.memo = merged.memo ? merged.memo + " / " + local.memo : local.memo;
  }
  return merged;
}

// 이 기기에서 이 계정으로 처음 로그인할 때 한 번만 실행.
// 매번 합치면 다른 기기에서 지운 루틴이 되살아나므로, 이후에는 나중에 저장한 쪽이 이김
async function mergeLocalIntoAccount(path) {
  const [daySnap, defaultsSnap] = await Promise.all([
    fs.getDocs(fs.collection(db, path, "days")),
    fs.getDoc(fs.doc(db, path, "meta", DEFAULTS_DOC))
  ]);
  const remoteDays = {};
  daySnap.forEach((d) => { remoteDays[d.id] = d.data().value; });

  // 빈 기록을 가려내려면 합치기 전 기본 루틴이 필요하므로 먼저 판별
  const untouched = new Set(dateKeys().filter((key) => isUntouched(key)));

  if (defaultsSnap.exists()) {
    const remote = JSON.parse(defaultsSnap.data().value);
    const localItems = data.items;
    const localSubs = data.subItems;
    const localDates = data.routineDates;
    syncedJson[DEFAULTS_DOC] = defaultsSnap.data().value;
    data.routineDates = remote.routineDates || {};
    localItems.filter((item) => !remote.items.includes(item) && localDates[item]).forEach((item) => {
      data.routineDates[item] = localDates[item];
    });
    data.items = remote.items.concat(localItems.filter((item) => !remote.items.includes(item)));
    data.subItems = remote.subItems;
    Object.keys(localSubs).forEach((item) => {
      const known = data.subItems[item] || [];
      data.subItems[item] = known.concat(localSubs[item].filter((sub) => !known.includes(sub)));
    });
  }

  untouched.forEach((key) => { delete data[key]; });
  Object.keys(remoteDays).forEach((key) => {
    const remote = JSON.parse(remoteDays[key]);
    syncedJson[key] = remoteDays[key];
    data[key] = data[key] ? mergeEntry(data[key], remote) : remote;
  });
  getEntry(todayKey);
}

function clearLocalData() {
  Object.keys(data).forEach((key) => { delete data[key]; });
  data.items = [];
  data.subItems = {};
  data.routineDates = {};
}

async function startSync(user) {
  userPath = null;
  syncedJson = {};
  const path = "users/" + user.uid;
  setAccountText(user.email + " · 동기화 중");

  const savedUid = readSyncUid();
  if (savedUid && savedUid !== user.uid) clearLocalData();

  if (savedUid !== user.uid) {
    // 합치기가 실패하면 uid를 남기지 않아서 다음에 다시 시도함.
    // 합치는 동안의 저장이 계정 기록을 덮어쓰지 않도록 userPath는 끝난 뒤에 설정
    await mergeLocalIntoAccount(path);
    writeSyncUid(user.uid);
  } else {
    // 같은 계정이면 저장된 사본을 서버 기준으로 보고, 달라진 문서만 아래 구독에서 반영함
    dateKeys().forEach((key) => { syncedJson[key] = JSON.stringify(data[key]); });
    if (!data[todayKey] || isUntouched(todayKey)) delete syncedJson[todayKey];
    syncedJson[DEFAULTS_DOC] = defaultsJson();
  }

  userPath = path;
  saveData();
  renderAll();

  const onError = () => setAccountText(user.email + " · 동기화 오류");

  stopListening = [
    // 서버 확인만 끝나고 내용이 그대로일 때도 상태를 갱신하려고 메타데이터 변경까지 받음
    fs.onSnapshot(fs.collection(db, path, "days"), { includeMetadataChanges: true }, (snap) => {
      let changed = false;
      snap.docChanges().forEach((change) => {
        // 아직 서버에 안 올라간 내 쓰기는 이미 화면에 반영돼 있음
        if (change.type === "removed" || change.doc.metadata.hasPendingWrites) return;
        if (applyRemoteDay(change.doc.id, change.doc.data().value)) changed = true;
      });
      if (changed) { saveLocalOnly(); renderAll(); }
      let status = " · 동기화됨";
      if (snap.metadata.fromCache) status = " · 연결 기다리는 중";
      else if (snap.metadata.hasPendingWrites) status = " · 저장 중";
      setAccountText(user.email + status);
    }, onError),
    fs.onSnapshot(fs.doc(db, path, "meta", DEFAULTS_DOC), (snap) => {
      if (snap.exists() && !snap.metadata.hasPendingWrites && applyRemoteDefaults(snap.data().value)) {
        saveLocalOnly();
        renderAll();
      }
    }, onError)
  ];
}

function stopSync() {
  stopListening.forEach((stop) => stop());
  stopListening = [];
  userPath = null;
}

// 공용 기기에 기록이 남지 않도록 로그아웃하면 이 기기의 사본을 지움. 기록은 계정에 남아 있음
async function logOut(auth, signOut) {
  flushMemo();
  const uploaded = await Promise.race([
    fs.waitForPendingWrites(db).then(() => true, () => false),
    new Promise((resolve) => setTimeout(() => resolve(false), 3000))
  ]);
  const message = uploaded
    ? "로그아웃하면 이 기기의 사본을 지워요. 기록은 계정에 남아 있어요."
    : "아직 올리지 못한 기록이 있어요. 지금 로그아웃하면 그 내용은 사라져요.";
  if (!confirm(message)) return;
  stopSync();
  await signOut(auth);
  await fs.terminate(db);
  await fs.clearIndexedDbPersistence(db).catch(() => {});
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SYNC_UID_KEY);
  } catch (e) {
    // 지우지 못해도 다음 로그인에서 uid를 비교해 처리됨
  }
  location.reload();
}

// SDK는 화면을 다 그린 뒤 불러옴: 네트워크가 안 돼도 이 기기 저장으로 앱은 계속 쓸 수 있음
export async function initSync(render) {
  renderAll = render;
  setSaveListener(pushChanges);
  try {
    const [appSdk, authSdk, firestoreSdk] = await Promise.all([
      import(SDK_URL + "firebase-app.js"),
      import(SDK_URL + "firebase-auth.js"),
      import(SDK_URL + "firebase-firestore.js")
    ]);
    fs = firestoreSdk;
    const app = appSdk.initializeApp(firebaseConfig);
    const auth = authSdk.getAuth(app);
    // 오프라인에서 쓴 내용이 앱을 닫아도 남아 있다가 연결되면 올라가도록 기기에 보관
    db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() })
    });

    let currentUser = null;
    accountBtn.hidden = false;
    accountBtn.addEventListener("click", async () => {
      if (currentUser) {
        logOut(auth, authSdk.signOut);
        return;
      }
      try {
        // 리디렉션은 github.io처럼 authDomain과 다른 도메인에서 Safari 등이 막아서 팝업을 씀
        await authSdk.signInWithPopup(auth, new authSdk.GoogleAuthProvider());
      } catch (e) {
        if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
          setAccountText(e.code === "auth/popup-blocked" ? "팝업이 막혀서 로그인하지 못했어요" : "로그인하지 못했어요");
        }
      }
    });

    authSdk.onAuthStateChanged(auth, async (user) => {
      stopSync();
      currentUser = user;
      accountBtn.textContent = user ? "로그아웃" : "구글 로그인";
      if (!user) {
        setAccountText("이 기기에만 저장 중 · 로그인하면 폰과 웹이 동기화돼요");
        return;
      }
      try {
        await startSync(user);
      } catch (e) {
        userPath = null;
        setAccountText(user.email + " · 동기화 오류");
      }
    });
  } catch (e) {
    setAccountText("이 기기에만 저장 중 · 동기화를 불러오지 못했어요");
  }
}
