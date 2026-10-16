/* Firebase owns identity; the server owns roles, money, inventory and orders. */
(() => {
'use strict';
const CDN='https://www.gstatic.com/firebasejs/11.10.0/';
let sdk,pending,resolver,totpSecret,appCheck,captchaScript;
const toast=(m,t)=>window.GNStore?.toast(m,t);
const errorMessage=e=>({'auth/invalid-credential':'Email বা password সঠিক নয়।','auth/operation-not-allowed':'Firebase Console-এ provider চালু করুন।','auth/unauthorized-domain':'Firebase authorized domains-এ এই domain যোগ করুন।','auth/popup-blocked':'Sign-in popup অনুমোদন করুন।','auth/popup-closed-by-user':'Sign-in popup বন্ধ হয়েছে।','auth/email-already-in-use':'এই email-এর account আছে। Sign in বা reset করুন।','auth/requires-recent-login':'Sign out করে আবার sign in করুন।'}[e.code]||e.message||'Authentication failed.');
async function init(){
  if(pending)return pending;
  pending=(async()=>{
    const cfg=await GNConfigReady;if(!cfg.firebase?.enabled)throw new Error('Firebase sign-in এখন unavailable.');
    const [appSDK,authSDK]=await Promise.all([import(CDN+'firebase-app.js'),import(CDN+'firebase-auth.js')]);
    const app=appSDK.getApps().length?appSDK.getApp():appSDK.initializeApp(cfg.firebase.config),auth=authSDK.getAuth(app);
    await authSDK.setPersistence(auth,authSDK.browserLocalPersistence);await auth.authStateReady();
    sdk={app,auth,...authSDK};
    if(cfg.firebase.appCheckSiteKey){
      const ac=await import(CDN+'firebase-app-check.js');
      appCheck={instance:ac.initializeAppCheck(app,{provider:new ac.ReCaptchaV3Provider(cfg.firebase.appCheckSiteKey),isTokenAutoRefreshEnabled:true}),getToken:ac.getToken};
    }
    return sdk;
  })().catch(error=>{pending=null;throw error;});
  return pending;
}
async function appCheckToken(){
  if(!(await GNConfigReady).firebase?.appCheckSiteKey)return '';
  await init();return (await appCheck.getToken(appCheck.instance,false)).token;
}
const captchaWidgets=new WeakMap();
async function loadCaptcha(){
  if(window.grecaptcha?.render)return;
  if(!captchaScript)captchaScript=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://www.google.com/recaptcha/api.js?render=explicit';script.async=true;script.defer=true;
    script.onload=()=>grecaptcha.ready(resolve);script.onerror=()=>reject(new Error('Verification challenge load হয়নি।'));document.head.append(script);
  }).catch(error=>{captchaScript=null;throw error;});
  return captchaScript;
}
async function mountCaptcha(){
  const cfg=await GNConfigReady;if(!cfg.recaptcha?.enabled||cfg.recaptcha.mode==='v3')return;
  try{await loadCaptcha();document.querySelectorAll('[data-recaptcha]').forEach(box=>{if(!captchaWidgets.has(box))captchaWidgets.set(box,grecaptcha.render(box,{sitekey:cfg.recaptcha.siteKey}));});}catch(error){toast(error.message,'err');}
}
async function captcha(action,scope=document){
  const cfg=await GNConfigReady;if(!cfg.recaptcha?.enabled)return null;
  if(cfg.recaptcha.mode==='v3'){
    if(!window.grecaptcha?.execute)await new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://www.google.com/recaptcha/api.js?render='+encodeURIComponent(cfg.recaptcha.siteKey);script.onload=()=>grecaptcha.ready(resolve);script.onerror=()=>reject(new Error('Verification load failed'));document.head.append(script);
    });
    return grecaptcha.execute(cfg.recaptcha.siteKey,{action});
  }
  await mountCaptcha();
  const box=scope.querySelector('[data-recaptcha]')||document.querySelector('[data-recaptcha="login"]'),widget=box&&captchaWidgets.get(box),token=widget===undefined?'':grecaptcha.getResponse(widget);
  if(!token)throw new Error('Verification challenge সম্পন্ন করুন।');
  return token;
}
async function exchange(user,name,form){
  const result=await GNApi.post('/api/auth/firebase/session',{id_token:await user.getIdToken(true),name:name||null,recaptcha_token:await captcha('login',form||document)});
  GNStore.store.setUser(result);await GNStore.loadCustomer();GNStore.render();return result;
}
async function complete(result,name,form){
  resolver=null;const user=await exchange(result.user,name,form);
  toast(user.email_verified?'Signed in.':'Verification email দেখুন; order দিতে email verify করুন।','ok');
  const intended=sessionStorage.getItem('gn_return_to');sessionStorage.removeItem('gn_return_to');
  location.hash=intended==='admin'&&user.role!=='customer'?'#/admin':'#/account';
}
async function mfa(error){
  const s=await init();resolver=s.getMultiFactorResolver(s.auth,error);
  if(!resolver.hints.some(h=>h.factorId==='totp'))throw new Error('Configured second factor TOTP নয়। Supported provider setup যাচাই করুন।');
  const box=document.querySelector('.gn-auth-form .co-card');if(!box)throw new Error('Account sign-in page খুলে MFA করুন।');
  box.innerHTML='<h2>Staff verification</h2><p>Authenticator-এর 6-digit code লিখুন।</p><form data-firebase="mfa"><label class="field"><span class="lbl">Code</span><input class="input en" name="code" required pattern="[0-9]{6}" maxlength="6" inputmode="numeric" autocomplete="one-time-code"></label><div data-recaptcha="login"></div><button class="btn btn-primary btn-block" type="submit">Verify</button></form>';
  await mountCaptcha();
}
async function logout(){
  await GNApi.post('/api/auth/logout',{});
  if(sdk)await sdk.signOut(sdk.auth);else if(window.GNConfig?.firebase?.enabled){try{const s=await init();await s.signOut(s.auth);}catch(_){}}
  window.GNStore?.store.logout();sessionStorage.removeItem('gn_authenticated');sessionStorage.removeItem('gn_admin_authenticated');
}
document.addEventListener('submit',async event=>{
  const form=event.target;if(!form.hasAttribute('data-firebase'))return;
  event.preventDefault();if(form.dataset.busy||!form.reportValidity())return;
  const kind=form.dataset.firebase||form.dataset.form,fd=new FormData(form),get=k=>k==='password'?String(fd.get(k)||''):String(fd.get(k)||'').trim(),button=form.querySelector('[type=submit]');
  form.dataset.busy='1';if(button)button.disabled=true;
  try{
    const s=await init();
    if(kind==='login')await complete(await s.signInWithEmailAndPassword(s.auth,get('email'),get('password')),null,form);
    else if(kind==='register'){
      const result=await s.createUserWithEmailAndPassword(s.auth,get('email'),get('password'));
      await s.updateProfile(result.user,{displayName:get('name')});await s.sendEmailVerification(result.user);await complete(result,get('name'),form);
    }else if(kind==='mfa'){
      if(!resolver)throw new Error('Sign-in আবার শুরু করুন।');
      const hint=resolver.hints.find(h=>h.factorId==='totp');
      await complete(await resolver.resolveSignIn(s.TotpMultiFactorGenerator.assertionForSignIn(hint.uid,get('code'))),null,form);
    }else if(kind==='reset'){await s.sendPasswordResetEmail(s.auth,get('email'));toast('Account থাকলে reset email পাঠানো হবে।','ok');form.reset();}
    else if(kind==='totp-start'){
      if(!s.auth.currentUser?.emailVerified)throw new Error('Verified email দিয়ে sign in করুন।');
      await s.reauthenticateWithCredential(s.auth.currentUser,s.EmailAuthProvider.credential(s.auth.currentUser.email,get('password')));
      totpSecret=await s.TotpMultiFactorGenerator.generateSecret(await s.multiFactor(s.auth.currentUser).getSession());
      const box=document.getElementById('gnTotpEnroll');
      box.innerHTML='<p class="note-box">Authenticator app-এ secret manual entry করুন। কাউকে দেবেন না।</p><code class="gn-private-code"></code><form data-firebase="totp-finish"><label class="field"><span class="lbl">6-digit code</span><input class="input en" name="code" required pattern="[0-9]{6}" autocomplete="one-time-code"></label><button class="btn btn-primary" type="submit">Confirm MFA</button></form>';
      box.querySelector('code').textContent=totpSecret.secretKey;
    }else if(kind==='totp-finish'){
      if(!totpSecret||!s.auth.currentUser)throw new Error('Enrollment আবার শুরু করুন।');
      await s.multiFactor(s.auth.currentUser).enroll(s.TotpMultiFactorGenerator.assertionForEnrollment(totpSecret,get('code')),'Glow Nuture staff');
      totpSecret=null;await logout();toast('MFA enabled. আবার sign in করুন।','ok');location.hash='#/account';
    }
  }catch(error){if(error.code==='auth/multi-factor-auth-required'){try{await mfa(error);}catch(next){toast(errorMessage(next),'err');}}else toast(errorMessage(error),'err');}
  finally{delete form.dataset.busy;if(button)button.disabled=false;const box=form.querySelector('[data-recaptcha]'),widget=box&&captchaWidgets.get(box);if(widget!==undefined)window.grecaptcha?.reset(widget);}
});
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-firebase-action]');if(!button||button.disabled)return;
  event.preventDefault();button.disabled=true;
  try{
    const s=await init(),cfg=await GNConfigReady,action=button.dataset.firebaseAction;
    if(action==='google'||action==='facebook'){
      if(!cfg.firebase[action])throw new Error('Provider setup pending.');
      await captcha('login');
      const provider=action==='google'?new s.GoogleAuthProvider():new s.FacebookAuthProvider();
      if(action==='facebook')provider.addScope('email');
      await complete(await s.signInWithPopup(s.auth,provider),null,document);
    }else if(action==='verify'){if(!s.auth.currentUser)throw new Error('Sign in required');await s.sendEmailVerification(s.auth.currentUser);toast('Verification email sent.','ok');}
    else if(action==='refresh-identity'){if(!s.auth.currentUser)throw new Error('Sign in required');await s.reload(s.auth.currentUser);await exchange(s.auth.currentUser);toast('Verification status refreshed.','ok');}
  }catch(error){if(error.code==='auth/multi-factor-auth-required'){try{await mfa(error);}catch(next){toast(errorMessage(next),'err');}}else toast(errorMessage(error),'err');}
  finally{if(button.isConnected)button.disabled=false;}
});
async function enablePush(){
  const s=await init(),cfg=await GNConfigReady;
  if(!s.auth.currentUser||!GNStore.store.state.user)throw new Error('Sign in to enable push.');
  if(!('Notification' in window)||!('serviceWorker' in navigator))throw new Error('Browser push unsupported.');
  if(await Notification.requestPermission()!=='granted')throw new Error('Notification permission was not granted.');
  const messaging=await import(CDN+'firebase-messaging.js');if(!await messaging.isSupported())throw new Error('Browser push unsupported.');
  const registration=await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const token=await messaging.getToken(messaging.getMessaging(s.app),{vapidKey:cfg.firebase.vapidKey,serviceWorkerRegistration:registration});
  if(!token)throw new Error('Notification token unavailable.');
  await GNApi.post('/api/push/subscriptions',{token,consent:true,marketing:false});
  messaging.onMessage(messaging.getMessaging(s.app),p=>{if(p.data?.title)toast(p.data.title);});
}
let analytics;
async function consentAnalytics(enabled){
  if(!(await GNConfigReady).analyticsEnabled||(!enabled&&!analytics))return;
  const s=await init(),a=await import(CDN+'firebase-analytics.js');
  if(await a.isSupported()){analytics=analytics||a.getAnalytics(s.app);a.setAnalyticsCollectionEnabled(analytics,Boolean(enabled));}
}
window.GNAuth={init,logout,captcha,mountCaptcha,appCheckToken,enablePush,consentAnalytics};
document.addEventListener('gn-render',()=>setTimeout(mountCaptcha,80));document.addEventListener('gn-auth-mounted',mountCaptcha);
})();
