/* Registered after explicit push opt-in. Never caches order, account or API responses. */
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');
firebase.initializeApp(self.GN_FIREBASE_CONFIG);
firebase.messaging().onBackgroundMessage(async payload=>{
  const data=payload.data||{};if(!data.title)return;
  const url=new URL(data.url||'/#/account/notifications',self.location.origin),tag=data.event_key||'glow-account';
  if((await self.registration.getNotifications({tag})).length)return;
  return self.registration.showNotification(String(data.title).slice(0,160),{body:String(data.body||'').slice(0,500),icon:'/assets/favicon.svg',tag,renotify:false,data:{url:url.origin===self.location.origin?url.href:self.location.origin+'/#/account/notifications'}});
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();const url=event.notification.data?.url||'/#/account/notifications';
  event.waitUntil((async()=>{
    const tabs=await clients.matchAll({type:'window',includeUncontrolled:true}),tab=tabs.find(t=>new URL(t.url).origin===self.location.origin);
    if(tab){await tab.navigate(url);return tab.focus();}return clients.openWindow(url);
  })());
});
