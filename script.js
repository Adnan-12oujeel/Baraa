'use strict';

/**
 * ملف الإعدادات الوحيد الذي تحتاج إلى تعديله.
 * هذا الموقع لا يستخدم React أو npm أو أي مكتبة JavaScript خارجية.
 * ضع روابط Google Maps الدقيقة فقط بعد تأكيدها؛ ترك الرابط فارغًا يُظهر رسالة توضيحية.
 */
const WEDDING_CONFIG = Object.freeze({
  groomName: 'براء',
  brideLabel: 'كريمته',
  weddingDate: '2026-10-20T19:00:00+03:00', // الثلاثاء 7 مساءً بتوقيت سوريا (UTC+3)
  weddingDurationHours: 3,
  menVenue: {
    name: 'صالة البعاج',
    address: 'مدينة أعزاز، سوريا',
    mapUrl: '' // الصق رابط الصالة المؤكد هنا
  },
  womenVenue: {
    name: 'تفاصيل الصالة قريبًا',
    address: 'سيتم إعلان الموقع عند تأكيده',
    mapUrl: '' // الصق رابط صالة النساء المؤكد هنا
  },
  supabase: {
    url: '', // مثال: https://YOUR_PROJECT.supabase.co
    anonKey: '' // المفتاح العام publishable/anon فقط - لا تضع service_role
  }
});

const $ = (selector) => document.querySelector(selector);
const timeZero = (value) => String(Math.max(0, value)).padStart(2, '0');
let toastTimer;

function showToast(message) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3600);
}

// 1) فتح الظرف: تأثير ثلاثي الأبعاد ثم كشف الموقع من دون إعادة تحميل.
function prepareEnvelope() {
  const gate = $('#invitationGate');
  const main = $('#main-content');
  let opening = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function openEnvelope() {
    if (opening) return;
    opening = true;
    gate.classList.add('is-opening');
    $('#openInvitation').disabled = true;
    $('#openInvitationText').disabled = true;
    const revealAfter = reducedMotion ? 0 : 1450;
    setTimeout(() => {
      main.removeAttribute('inert');
      document.body.classList.remove('invitation-locked');
      gate.classList.add('is-fading');
      const heroTitle = $('#heroTitle');
      heroTitle.setAttribute('tabindex', '-1');
      heroTitle.focus({ preventScroll: true });
      setTimeout(() => {
        gate.remove();
        heroTitle.removeAttribute('tabindex');
      }, reducedMotion ? 0 : 750);
    }, revealAfter);
  }

  $('#openInvitation').addEventListener('click', openEnvelope);
  $('#openInvitationText').addEventListener('click', openEnvelope);
}

// 2) العد التنازلي للحدث، دائمًا في التوقيت الصحيح أينما كان الضيف.
function prepareCountdown() {
  const target = new Date(WEDDING_CONFIG.weddingDate).getTime();
  const tiles = $('#countdownGrid');
  const finished = $('#countdownEnded');

  if (!Number.isFinite(target)) {
    tiles.hidden = true;
    finished.hidden = false;
    finished.textContent = 'يرجى مراجعة تاريخ الحفل في إعدادات الموقع.';
    return;
  }

  function tick() {
    const diff = Math.max(0, target - Date.now());
    if (diff === 0) {
      tiles.hidden = true;
      finished.hidden = false;
      clearInterval(interval);
      return;
    }
    const total = Math.floor(diff / 1000);
    $('#days').textContent = timeZero(Math.floor(total / 86400));
    $('#hours').textContent = timeZero(Math.floor((total % 86400) / 3600));
    $('#minutes').textContent = timeZero(Math.floor((total % 3600) / 60));
    $('#seconds').textContent = timeZero(total % 60);
  }

  // ابدأ بنبضة فورية ثم حدث كل ثانية.
  const interval = setInterval(tick, 1000);
  tick();
}

// 3) روابط المواقع: لا نضع رابطًا عامًا أو دبوسًا مفترضًا.
function isSafeMapLink(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' && (
      url.hostname === 'google.com' || url.hostname.endsWith('.google.com') ||
      url.hostname === 'maps.app.goo.gl' || url.hostname === 'goo.gl' ||
      url.hostname === 'openstreetmap.org' || url.hostname.endsWith('.openstreetmap.org') ||
      url.hostname === 'maps.apple.com'
    );
  } catch { return false; }
}

function updateVenue(prefix, venue) {
  $(`#${prefix}VenueName`).textContent = venue.name;
  const addressEl = prefix === 'men' ? $('.venue-card:first-child .venue-address') : $('#womenVenueAddress');
  if (addressEl) {
    const icon = addressEl.querySelector('svg');
    addressEl.replaceChildren(icon, document.createTextNode(` ${venue.address}`));
  }
  const link = $(`#${prefix}MapLink`);
  const pending = $(`#${prefix}MapPending`);
  if (isSafeMapLink(venue.mapUrl.trim())) {
    link.href = venue.mapUrl.trim();
    link.hidden = false;
    pending.hidden = true;
  } else {
    link.hidden = true;
    pending.hidden = false;
  }
}

// 4) ملف تقويم محلي .ics يعمل مع أغلب تطبيقات التقويم.
function toICSDate(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
function escapeICS(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}
function prepareCalendar() {
  $('#addToCalendar').addEventListener('click', () => {
    const start = new Date(WEDDING_CONFIG.weddingDate);
    if (Number.isNaN(start.getTime())) return showToast('تاريخ الزفاف غير صالح.');
    const end = new Date(start.getTime() + WEDDING_CONFIG.weddingDurationHours * 3600000);
    const summary = `زفاف ${WEDDING_CONFIG.groomName} و${WEDDING_CONFIG.brideLabel}`;
    const description = 'يسعدنا أن تشاركونا فرحة العمر. تجدون مواقع الصالات في رابط الدعوة.';
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wedding Invitation//AR//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', `UID:wedding-baraa-20261020@wedding-invite`, `DTSTAMP:${toICSDate(new Date())}`,
      `DTSTART:${toICSDate(start)}`, `DTEND:${toICSDate(end)}`,
      `SUMMARY:${escapeICS(summary)}`, `DESCRIPTION:${escapeICS(description)}`,
      'END:VEVENT', 'END:VCALENDAR', ''
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'wedding-20-10-2026.ics';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showToast('تم تجهيز ملف التقويم لإضافته إلى مواعيدك.');
  });
}

// 5) مشاركة الرابط: استخدم مشاركة الهاتف أو نسخ الرابط.
function prepareSharing() {
  $('#shareInvitation').addEventListener('click', async () => {
    const data = {
      title: 'دعوة زفاف براء وكريمته',
      text: 'بكل الحب ندعوكم لمشاركتنا فرحة زفاف براء وكريمته، الثلاثاء 20 أكتوبر 2026.',
      url: window.location.href.split('#')[0]
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(data.url);
      } else {
        const temp = document.createElement('textarea');
        temp.value = data.url;
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.append(temp);
        temp.select();
        if (!document.execCommand('copy')) throw new Error('clipboard unavailable');
        temp.remove();
      }
      showToast('تم نسخ رابط الدعوة، يمكنك مشاركته الآن.');
    } catch (err) {
      if (err.name !== 'AbortError') showToast('لم يتم نسخ الرابط تلقائيًا. انسخه من شريط العنوان.');
    }
  });
}

// 6) رسائل المعازيم: Supabase حقيقي (إذا ضُبط)، أو حفظ محلي واضح المعنى.
const STORAGE_KEY = 'baraa-wedding-guestbook-v1';
const remoteEnabled = Boolean(
  /^https:\/\/[\w.-]+\.supabase\.co\/?$/.test(WEDDING_CONFIG.supabase.url.trim()) &&
  WEDDING_CONFIG.supabase.anonKey.trim()
);
function supabaseHeaders() {
  const key = WEDDING_CONFIG.supabase.anonKey.trim();
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  // مفاتيح sb_publishable_ ليست JWT ولا يجب وضعها في Authorization.
  // مفتاح anon القديم (JWT) يمكن تمريره أيضًا كـ Bearer للتوافق.
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  return headers;
}
function supabaseEndpoint(query = '') {
  return `${WEDDING_CONFIG.supabase.url.trim().replace(/\/$/, '')}/rest/v1/wedding_wishes${query}`;
}
function localWishes() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter(item => item && typeof item.guest_name === 'string' && typeof item.message === 'string') : [];
  } catch { return []; }
}
function saveLocalWish(record) {
  // تمنع هذه الآلية فقدان الرسالة بسبب تعطل localStorage من دون إبلاغ الضيف.
  const items = [record, ...localWishes()].slice(0, 40);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  return items;
}
function renderWishes(items) {
  const list = $('#wishesList');
  list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'wishes-empty';
    empty.textContent = 'كونوا أول من يترك تهنئة جميلة ♡';
    list.append(empty);
    return;
  }
  for (const wish of items.slice(0, 9)) {
    const card = document.createElement('article');
    card.className = 'wish-card';
    const heading = document.createElement('h4');
    heading.textContent = wish.guest_name;
    const message = document.createElement('p');
    message.textContent = wish.message;
    card.append(heading, message);
    if (wish.created_at && !Number.isNaN(Date.parse(wish.created_at))) {
      const dateEl = document.createElement('time');
      dateEl.dateTime = wish.created_at;
      dateEl.textContent = new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(wish.created_at));
      card.append(dateEl);
    }
    list.append(card);
  }
}
async function fetchApprovedWishes() {
  const response = await fetch(supabaseEndpoint('?select=guest_name,message,created_at&approved=eq.true&order=created_at.desc&limit=9'), {
    headers: supabaseHeaders()
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Unexpected response');
  return data;
}
async function insertWish(name, message) {
  const response = await fetch(supabaseEndpoint(), {
    method: 'POST',
    headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ guest_name: name, message, approved: false })
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}
function setWishFeedback(message, type = '') {
  const el = $('#wishStatus');
  el.textContent = message;
  el.className = `wish-status ${type ? `is-${type}` : ''}`;
}
async function prepareGuestbook() {
  const form = $('#wishForm');
  const nameEl = $('#guestName');
  const messageEl = $('#wishMessage');
  const submit = $('#submitWish');
  const modeEl = $('#wishMode');

  messageEl.addEventListener('input', () => { $('#charCount').textContent = `${messageEl.value.length} / 500`; });
  modeEl.textContent = remoteEnabled
    ? 'تُرسل التهاني للعروسين، ولا تظهر للعموم إلا بعد اعتمادها.'
    : 'وضع المعاينة: تُحفظ التهاني على هذا الجهاز فقط. لتمكين التهاني المشتركة اتبع README.';

  if (remoteEnabled) {
    try { renderWishes(await fetchApprovedWishes()); }
    catch { $('#wishesList').textContent = 'تعذّر عرض التهاني الآن. يرجى المحاولة لاحقًا.'; }
  } else {
    renderWishes(localWishes());
  }

  let lastSubmittedAt = 0;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = nameEl.value.trim().replace(/\s+/g, ' ');
    const message = messageEl.value.trim();
    if (name.length < 2 || name.length > 60) return setWishFeedback('يرجى إدخال اسم من حرفين إلى 60 حرفًا.', 'error');
    if (message.length < 5 || message.length > 500) return setWishFeedback('يجب أن تتألف التهنئة من 5 إلى 500 حرف.', 'error');
    if (Date.now() - lastSubmittedAt < 15000) return setWishFeedback('يرجى الانتظار قليلًا قبل إرسال تهنئة أخرى.', 'error');
    submit.disabled = true;
    submit.textContent = 'جارٍ إرسال التهنئة...';
    setWishFeedback('');
    try {
      if (remoteEnabled) {
        await insertWish(name, message);
        setWishFeedback('شكرًا من القلب! وصلت تهنئتك، وستظهر بعد مراجعتها واعتمادها.', 'success');
      } else {
        const items = saveLocalWish({ guest_name: name, message, created_at: new Date().toISOString() });
        renderWishes(items);
        setWishFeedback('حُفظت تهنئتك على جهازك بنجاح. لن يراها الزوار الآخرون في وضع المعاينة.', 'success');
      }
      lastSubmittedAt = Date.now();
      form.reset();
      $('#charCount').textContent = '0 / 500';
    } catch {
      setWishFeedback(remoteEnabled
        ? 'تعذّر إرسال التهنئة للخادم. تحقق من الاتصال وحاول مجددًا.'
        : 'تعذّر حفظ التهنئة في هذا المتصفح. تحقق من مساحة التخزين أو الخصوصية.', 'error');
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'إرسال التهنئة <span aria-hidden="true">←</span>';
    }
  });
}

// 7) ظهور العناصر عند التمرير، مع احترام إعداد «تقليل الحركة».
function prepareReveals() {
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const elements = document.querySelectorAll('.reveal');
  document.documentElement.classList.add('js-observing');
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: .09, rootMargin: '0px 0px -12px 0px' });
  elements.forEach(element => observer.observe(element));
}

function main() {
  prepareEnvelope();
  prepareCountdown();
  updateVenue('men', WEDDING_CONFIG.menVenue);
  updateVenue('women', WEDDING_CONFIG.womenVenue);
  prepareCalendar();
  prepareSharing();
  prepareReveals();
  void prepareGuestbook();
}

main();
