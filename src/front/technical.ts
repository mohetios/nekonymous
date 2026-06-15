export const TechnicalPageContent = () => `
  <div class="max-w-4xl mx-auto p-4 text-gray-800">
    <p class="text-sm text-gray-500 mb-6">
      <a href="/about" class="text-blue-600 hover:text-blue-800">← بازگشت به درباره</a>
    </p>

    <p class="text-lg leading-relaxed mb-6">
      این صفحه برای توسعه‌دهندگان، اپراتورها و کاربران پیشرفته‌ای است که می‌خواهند
      <strong>معماری، جریان داده و قرارداد ذخیره‌سازی</strong> نِکونیموس را بدانند.
      خلاصهٔ کاربری در <a href="/about">درباره</a> آمده است.
    </p>

    <h2 class="text-2xl font-semibold mt-10 mb-4 border-b pb-2">۱. نمای کلی</h2>
    <p class="leading-relaxed mb-4">
      نِکونیموس یک <strong>Cloudflare Worker</strong> واحد است: وب‌هوک تلگرام (Grammy)،
      صفحات HTML سبک، و یک کلاس <strong>Durable Object</strong> برای صندوق ورودی هر گیرنده.
      هیچ سرور جدا، D1، یا صف پیامی وجود ندارد.
    </p>
    <div class="overflow-x-auto mb-6">
      <table class="min-w-full text-sm border border-gray-200 rounded-lg">
        <thead class="bg-gray-100">
          <tr>
            <th class="p-3 text-right border-b">لایه</th>
            <th class="p-3 text-right border-b">فناوری</th>
            <th class="p-3 text-right border-b">نقش</th>
          </tr>
        </thead>
        <tbody>
          <tr><td class="p-3 border-b">Edge</td><td class="p-3 border-b">Worker + Router</td><td class="p-3 border-b">مسیرها، وب‌هوک، HTML، پاک‌سازی ops</td></tr>
          <tr><td class="p-3 border-b">Bot</td><td class="p-3 border-b">Grammy</td><td class="p-3 border-b">دستورات، کیبورد، callbackهای اینلاین</td></tr>
          <tr><td class="p-3 border-b">پروفایل</td><td class="p-3 border-b">KV (JSON)</td><td class="p-3 border-b">کاربر، نقشه UUID، آمار</td></tr>
          <tr><td class="p-3 border-b">متن رمزشده</td><td class="p-3 border-b">KV (opaque text)</td><td class="p-3 border-b">blobهای AES؛ هرگز JSON.parse روی ciphertext</td></tr>
          <tr><td class="p-3 border-b">صف ورودی</td><td class="p-3 border-b">InboxSqliteDurableObject</td><td class="p-3 border-b">یک DO به ازای هر گیرنده؛ جدول SQLite</td></tr>
          <tr><td class="p-3">رمزنگاری</td><td class="p-3">Web Crypto</td><td class="p-3">HKDF-SHA-256 + AES-256-GCM</td></tr>
        </tbody>
      </table>
    </div>

    <h2 class="text-2xl font-semibold mt-10 mb-4 border-b pb-2">۲. مسیرهای HTTP</h2>
    <ul class="list-disc list-inside space-y-2 mb-6 text-sm leading-relaxed">
      <li><code class="bg-gray-100 px-1 rounded">GET /</code> — آمار تجمیعی از <code class="bg-gray-100 px-1 rounded">stats:total:*</code></li>
      <li><code class="bg-gray-100 px-1 rounded">GET /about</code> — راهنمای کاربری</li>
      <li><code class="bg-gray-100 px-1 rounded">GET /about/technical</code> — همین صفحه</li>
      <li><code class="bg-gray-100 px-1 rounded">POST /bot</code> — وب‌هوک؛ هدر <code class="bg-gray-100 px-1 rounded">X-Telegram-Bot-Api-Secret-Token</code></li>
    </ul>

    <h2 class="text-2xl font-semibold mt-10 mb-4 border-b pb-2">۳. فضای نام KV</h2>
    <p class="leading-relaxed mb-4">
      همهٔ کلیدها با پیشوند namespace در <code class="bg-gray-100 px-1 rounded">KVModel</code> ذخیره می‌شوند:
    </p>
    <ul class="list-disc list-inside space-y-2 mb-6 text-sm">
      <li><code class="bg-gray-100 px-1 rounded">user:{telegramId}</code> — نام نمایشی، UUID لینک، blockList، contactLabels، paused، پیش‌نویس مکالمه</li>
      <li><code class="bg-gray-100 px-1 rounded">userUUIDtoId:{uuid}</code> — توکن ۲۲ کاراکتری لینک → شناسهٔ تلگرام مالک</li>
      <li><code class="bg-gray-100 px-1 rounded">conversation:{conversationId}</code> — ciphertext AES (فرمت <code class="bg-gray-100 px-1 rounded">iv.ciphertext</code> base64url)</li>
      <li><code class="bg-gray-100 px-1 rounded">stats:newUser:YYYY-MM-DD</code> و <code class="bg-gray-100 px-1 rounded">stats:total:newUser</code> — شمارندهٔ روزانه و تجمیعی</li>
    </ul>

    <h2 class="text-2xl font-semibold mt-10 mb-4 border-b pb-2">۴. صندوق ورودی (SQLite DO)</h2>
    <p class="leading-relaxed mb-4">
      هر گیرنده یک نمونهٔ <code class="bg-gray-100 px-1 rounded">InboxSqliteDurableObject</code>
      با کلید <code class="bg-gray-100 px-1 rounded">idFromName(telegramId)</code> دارد.
      جدول <code class="bg-gray-100 px-1 rounded">inbox_entries</code>:
    </p>
    <ul class="list-disc list-inside space-y-2 mb-4 text-sm">
      <li><strong>ref</strong> — ۸ کاراکتر hex برای دکمه‌های اینلاین (<code class="bg-gray-100 px-1 rounded">rpl:</code> / <code class="bg-gray-100 px-1 rounded">blk:</code> / …)</li>
      <li><strong>ticket_id</strong> — تیکت تصادفی ۲۵۶ بیتی (نمک HKDF)</li>
      <li><strong>conversation_id</strong> — کلید مشتق‌شدهٔ KV</li>
      <li><strong>ciphertext</strong> — کپی blob تا زمان تحویل؛ پس از تحویل <code class="bg-gray-100 px-1 rounded">NULL</code></li>
      <li><strong>delivered</strong> — ۰ = در صف؛ ۱ = تحویل‌شده (ref برای callback باقی می‌ماند)</li>
    </ul>
    <p class="text-sm text-gray-600 mb-6">
      API داخلی DO: <code class="bg-gray-100 px-1 rounded">POST /add</code>،
      <code class="bg-gray-100 px-1 rounded">GET /list</code>،
      <code class="bg-gray-100 px-1 rounded">GET /entry?ref=</code>،
      <code class="bg-gray-100 px-1 rounded">POST /mark-delivered</code>،
      <code class="bg-gray-100 px-1 rounded">DELETE /purge</code>.
      سقف: <strong>۵۰ پیام در انتظار</strong>. برای محدود ماندن جدول، هنگام افزودن پیام جدید
      refهای تحویل‌شدهٔ قدیمی حذف می‌شوند.
    </p>

    <h2 class="text-2xl font-semibold mt-10 mb-4 border-b pb-2">۵. تیکت و رمزنگاری</h2>
    <p class="leading-relaxed mb-4">
      هر پیام یک <code class="bg-gray-100 px-1 rounded">ticketId</code> تازه می‌گیرد.
      تابع <code class="bg-gray-100 px-1 rounded">encryptConversationPayload</code> در یک فراخوانی:
    </p>
    <ol class="list-decimal list-inside space-y-2 mb-6 text-sm">
      <li><strong>conversationId</strong> — HKDF با info <code class="bg-gray-100 px-1 rounded">nekonymous:conversation:v1</code></li>
      <li><strong>ciphertext</strong> — AES-256-GCM با info <code class="bg-gray-100 px-1 rounded">nekonymous:aes:v1</code></li>
      <li>IKM: <code class="bg-gray-100 px-1 rounded">APP_SECURE_KEY</code>؛ salt: بایت‌های ticket</li>
    </ol>
    <p class="leading-relaxed mb-6 text-sm text-gray-700">
      <strong>نام مستعار:</strong> کلید HKDF جدا (<code class="bg-gray-100 px-1 rounded">nekonymous:label:v1:{senderId}</code>)
      روی <code class="bg-gray-100 px-1 rounded">user.contactLabels</code> ذخیره می‌شود — نه در ciphertext و نه در DO.
    </p>

    <h2 class="text-2xl font-semibold mt-10 mb-4 border-b pb-2">۶. چرخهٔ ciphertext (دو مخزن)</h2>
    <pre class="bg-gray-900 text-gray-100 text-xs p-4 rounded-lg overflow-x-auto mb-6 leading-relaxed" dir="ltr">SEND
  KV  conversation:{id}  ← connection + payload (encrypted)
  DO  inbox_entries     ← same ciphertext, delivered=0

/inbox DELIVER
  decrypt from DO row → Telegram
  KV  re-encrypt with empty payload (metadata only)
  DO  mark-delivered → ciphertext=NULL, ref kept

CALLBACK (reply / block / nickname)
  DO  /entry?ref=  → ticketId + conversationId
  KV  getText(conversationId) → decrypt connection</pre>
    <p class="leading-relaxed mb-6 text-sm">
      پس از تحویل، callbackها همیشه از <strong>KV</strong> می‌خوانند؛ DO فقط نگهدارندهٔ ref پایدار است.
    </p>

    <h2 class="text-2xl font-semibold mt-10 mb-4 border-b pb-2">۷. جریان‌های اصلی ربات</h2>
    <div class="space-y-6 text-sm leading-relaxed">
      <div class="bg-blue-50 border border-blue-100 rounded-lg p-4">
        <h3 class="font-semibold mb-2">باز کردن لینک (<code>/start {uuid}</code>)</h3>
        <p>اعتبارسنجی فرمت UUID → نقشه به مالک → بررسی self / block / pause →
        پیش‌نویس <code class="bg-white px-1 rounded">currentConversation.to</code>.</p>
      </div>
      <div class="bg-green-50 border border-green-100 rounded-lg p-4">
        <h3 class="font-semibold mb-2">ارسال پیام</h3>
        <p>رمزنگاری → KV → <code class="bg-white px-1 rounded">POST /add</code>.
        اگر ۵۰ پیام در انتظار وجود داشته باشد (<code class="bg-white px-1 rounded">429</code>)،
        کلید KV حذف می‌شود (بدون orphan). refهای تحویل‌شدهٔ قدیمی قبل از رد پیام prune می‌شوند.</p>
      </div>
      <div class="bg-purple-50 border border-purple-100 rounded-lg p-4">
        <h3 class="font-semibold mb-2">پاسخ در رشتهٔ موجود</h3>
        <p>اگر <code class="bg-white px-1 rounded">reply_to_message_id</code> از دکمهٔ پاسخ تنظیم شده باشد،
        <strong>pause</strong> گیرنده مانع ارسال نمی‌شود (فقط پیام‌های جدید از لینک مسدود می‌شوند).</p>
      </div>
    </div>

    <h2 class="text-2xl font-semibold mt-10 mb-4 border-b pb-2">۸. محدودیت‌های عملیاتی</h2>
    <ul class="list-disc list-inside space-y-2 mb-6 text-sm">
      <li>نرخ ارسال / باز کردن لینک: ۵ ثانیه برای هر کاربر</li>
      <li>حداکثر ۲۰۰ نام مستعار؛ هر برچسب حداکثر ۳۲ کاراکتر</li>
      <li>حداکثر ۵۰ پیام در انتظار برای هر inbox؛ callbackهای قدیمی ممکن است بعد از prune منقضی شوند</li>
      <li>فقط <code class="bg-gray-100 px-1 rounded">connection.to</code> مجاز به act روی ref است</li>
      <li>نام‌های نمایشی منو (مثل «تنظیمات») قابل ذخیره نیستند</li>
      <li>آمار وب‌هوک با <code class="bg-gray-100 px-1 rounded">waitUntil</code> به تأخیر می‌افتد تا ACK سریع بماند</li>
    </ul>

    <h2 class="text-2xl font-semibold mt-10 mb-4 border-b pb-2">۹. امنیت (خلاصهٔ فنی)</h2>
    <ul class="list-disc list-inside space-y-2 mb-6 text-sm leading-relaxed">
      <li>رمزنگاری در حالت سکون: AES-256-GCM؛ کلید per-ticket از HKDF</li>
      <li>میزبان relay است — E2E سرتاسری نیست؛ اپراتور با <code class="bg-gray-100 px-1 rounded">APP_SECURE_KEY</code> می‌تواند decrypt کند</li>
      <li>متن پیام پس از <code class="bg-gray-100 px-1 rounded">/inbox</code> از payload پاک می‌شود؛ metadata اتصال برای پاسخ/بلاک می‌ماند</li>
      <li>ticketId، کلیدها و plaintext در لاگ نوشته نمی‌شوند</li>
    </ul>

    <h2 class="text-2xl font-semibold mt-10 mb-4 border-b pb-2">۱۰. منبع و مستندات</h2>
    <p class="leading-relaxed mb-4">
      کد منبع:
      <a href="https://github.com/mehotkhan/Nekonymous" class="text-blue-600 hover:text-blue-800 font-medium">GitHub — Nekonymous</a>
    </p>
    <p class="text-sm text-gray-600">
      در ربات تلگرام: <strong>تنظیمات → 📐 معماری فنی</strong> یا دکمهٔ <strong>🛡️ درباره</strong> در منوی اصلی.
    </p>
  </div>
`;
