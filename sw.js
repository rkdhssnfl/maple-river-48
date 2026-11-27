// 홈 화면 추가(앱 설치)가 되도록 두는 파일입니다. 아무것도 저장하지 않고, 페이지는 늘 인터넷에서 새로 받아 옵니다.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () {});
