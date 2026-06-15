export const TechnicalPageContent = () => `
  <div class="space-y-10 text-gray-800">
    <p class="text-sm text-gray-500">
      <a href="/about" class="text-blue-600 hover:text-blue-800">← بازگشت به راهنمای ساده</a>
    </p>

    <section>
      <p class="text-sm text-blue-700 mb-2">نحوه کار و معماری، با زبان قابل خواندن</p>
      <h1 class="text-3xl font-bold mb-4">تصویر اصلی نِکونیموس</h1>
      <p class="text-lg leading-9 mb-4">
        نِکونیموس یک bot تلگرام نیست که فقط چند دستور داشته باشد؛ یک relay کوچک است.
        پیام از bot عبور می‌کند، در storage به شکل رمزنگاری‌شده می‌ماند، و به صاحب لینک از طریق /inbox تحویل داده می‌شود.
      </p>
      <p class="text-lg leading-9">
        این صفحه برای کسی است که می‌خواهد بداند «پیام از کجا می‌آید، کجا منتظر می‌ماند،
        بعد از خواندن چه می‌شود، و privacy دقیقاً تا کجاست»؛ بدون ورود به پیچیدگی الگوریتمی.
      </p>
    </section>

    <section class="rounded-xl border border-gray-200 bg-gray-50 p-5">
      <h2 class="text-2xl font-semibold mb-4">نقشه خیلی کوتاه</h2>
      <pre class="bg-gray-900 text-gray-100 text-xs p-4 rounded-lg overflow-x-auto leading-7" dir="ltr">Telegram link
  -> Cloudflare Worker
  -> Grammy bot flow
  -> encrypted message storage
  -> recipient inbox
  -> /inbox delivery
  -> reply / block / nickname callbacks</pre>
    </section>

    <section>
      <h2 class="text-2xl font-semibold mb-4">جریان کاربر، قدم‌به‌قدم</h2>
      <ol class="space-y-4">
        <li class="rounded-xl border border-gray-200 p-4">
          <strong>۱. ساخت لینک:</strong>
          کاربر با /start یک لینک شخصی می‌گیرد. این لینک به owner داخل storage وصل می‌شود،
          اما username Telegram owner برای فرستنده نمایش داده نمی‌شود.
        </li>
        <li class="rounded-xl border border-gray-200 p-4">
          <strong>۲. باز شدن لینک:</strong>
          فرستنده لینک را باز می‌کند. bot بررسی می‌کند لینک معتبر باشد، فرستنده خود owner نباشد،
          block نشده باشد، و owner دریافت پیام را pause نکرده باشد.
        </li>
        <li class="rounded-xl border border-gray-200 p-4">
          <strong>۳. ارسال پیام:</strong>
          پیام فقط اگر نوع آن پشتیبانی شود پذیرفته می‌شود. سپس payload برای storage رمزنگاری می‌شود
          و یک entry در inbox گیرنده ساخته می‌شود.
        </li>
        <li class="rounded-xl border border-gray-200 p-4">
          <strong>۴. خواندن inbox:</strong>
          owner با /inbox پیام‌های pending را دریافت می‌کند. bot پیام را decrypt می‌کند،
          از طریق Telegram تحویل می‌دهد، و بعد payload ذخیره‌شده را خالی می‌کند.
        </li>
        <li class="rounded-xl border border-gray-200 p-4">
          <strong>۵. بعد از تحویل:</strong>
          متن پیام در storage باقی نمی‌ماند، اما connection metadata رمزنگاری‌شده باقی می‌ماند
          تا reply، block، unblock و nickname هنوز کار کنند.
        </li>
      </ol>
    </section>

    <section class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="rounded-xl border border-green-200 bg-green-50 p-5">
        <h2 class="text-xl font-semibold mb-3">سیستم چه چیزی را کم می‌کند؟</h2>
        <ul class="list-disc list-inside space-y-2 leading-8">
          <li>نمایش username دو طرف در رابط bot</li>
          <li>نگه‌داری plaintext پیام در KV یا Durable Object</li>
          <li>باقی ماندن payload بعد از /inbox</li>
          <li>دسترسی اشتباه به callbackهای reply و block</li>
        </ul>
      </div>
      <div class="rounded-xl border border-yellow-200 bg-yellow-50 p-5">
        <h2 class="text-xl font-semibold mb-3">سیستم چه چیزی را حذف نمی‌کند؟</h2>
        <ul class="list-disc list-inside space-y-2 leading-8">
          <li>Telegram همچنان پیام اولیه را دریافت می‌کند.</li>
          <li>Worker هنگام پردازش، plaintext را می‌بیند.</li>
          <li>اپراتور و secretهای runtime بخشی از مدل اعتماد هستند.</li>
          <li>metadata لازم برای user، block، pause و nickname وجود دارد.</li>
        </ul>
      </div>
    </section>

    <section>
      <h2 class="text-2xl font-semibold mb-4">هر بخش کجا زندگی می‌کند؟</h2>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm border border-gray-200 rounded-lg">
          <thead class="bg-gray-100">
            <tr>
              <th class="p-3 text-right border-b">بخش</th>
              <th class="p-3 text-right border-b">کجا ذخیره یا اجرا می‌شود؟</th>
              <th class="p-3 text-right border-b">برای چه کاری؟</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="p-3 border-b">Webhook و صفحات وب</td>
              <td class="p-3 border-b">یک Cloudflare Worker</td>
              <td class="p-3 border-b">دریافت Telegram update، routeها، HTML سبک</td>
            </tr>
            <tr>
              <td class="p-3 border-b">منطق bot</td>
              <td class="p-3 border-b">Grammy داخل همان Worker</td>
              <td class="p-3 border-b">/start، /inbox، settings، callbackها</td>
            </tr>
            <tr>
              <td class="p-3 border-b">پروفایل و تنظیمات</td>
              <td class="p-3 border-b">Cloudflare KV</td>
              <td class="p-3 border-b">نام نمایشی، link id، block list، pause، nicknameها</td>
            </tr>
            <tr>
              <td class="p-3 border-b">متن رمزنگاری‌شده</td>
              <td class="p-3 border-b">KV با key از نوع conversation</td>
              <td class="p-3 border-b">نگه‌داری blob رمزنگاری‌شده تا زمان تحویل</td>
            </tr>
            <tr>
              <td class="p-3">inbox هر گیرنده</td>
              <td class="p-3">Durable Object + SQLite</td>
              <td class="p-3">صف pending، refهای callback، سقف ۵۰ row</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2 class="text-2xl font-semibold mb-4">چرا inbox جداست؟</h2>
      <p class="leading-8 mb-3">
        KV برای profile و link map خوب است، اما برای ترتیب inbox مناسب نیست.
        اگر چند نفر نزدیک به هم پیام بدهند، inbox باید یک نقطهٔ مشخص برای صف و تحویل داشته باشد.
      </p>
      <p class="leading-8">
        برای همین هر گیرنده یک Durable Object جدا دارد. این object پیام‌های pending را نگه می‌دارد،
        ظرفیت را محدود می‌کند، و بعد از تحویل ciphertext خودش را پاک می‌کند ولی ref لازم برای callback را نگه می‌دارد.
      </p>
    </section>

    <section>
      <h2 class="text-2xl font-semibold mb-4">رمزنگاری در حد لازم برای فهم مدل</h2>
      <p class="leading-8 mb-3">
        برای هر پیام پذیرفته‌شده یک ticket تصادفی ساخته می‌شود. سیستم با همان ticket و secret اصلی،
        کلید لازم برای رمزنگاری پیام و شناسه conversation را مشتق می‌کند. پیام با AES-GCM ذخیره می‌شود.
      </p>
      <p class="leading-8 mb-3">
        معنی عملی این بخش برای کاربر این است: بدنه پیام به شکل plaintext در KV یا inbox ذخیره نمی‌شود.
        بعد از /inbox هم payload از storage پاک می‌شود.
      </p>
      <p class="leading-8">
        اما این end-to-end encryption نیست. چون bot و Worker باید پیام را پردازش کنند،
        plaintext در لحظه پردازش دیده می‌شود.
      </p>
    </section>

    <section>
      <h2 class="text-2xl font-semibold mb-4">کنترل‌های کاربر</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="rounded-xl border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">block</h3>
          <p class="leading-8">فرستنده دیگر نمی‌تواند از لینک شما پیام جدید بفرستد.</p>
        </div>
        <div class="rounded-xl border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">pause</h3>
          <p class="leading-8">پیام‌های جدید از لینک متوقف می‌شوند؛ replyهای thread قبلی می‌توانند ادامه داشته باشند.</p>
        </div>
        <div class="rounded-xl border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">nickname</h3>
          <p class="leading-8">نام خصوصی برای تشخیص فرستنده‌های تکراری؛ فقط روی profile خودت نگه‌داری می‌شود.</p>
        </div>
        <div class="rounded-xl border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">پاک کردن حساب</h3>
          <p class="leading-8">لینک فعلی، inbox، block list و nicknameها پاک می‌شوند و لینک تازه ساخته می‌شود.</p>
        </div>
      </div>
    </section>

    <section class="rounded-xl border border-gray-200 bg-gray-50 p-5">
      <h2 class="text-2xl font-semibold mb-4">محدودیت‌های مهم</h2>
      <ul class="list-disc list-inside space-y-2 leading-8">
        <li>inbox هر گیرنده سقف ۵۰ row دارد؛ اگر همه pending باشند، پیام جدید پذیرفته نمی‌شود.</li>
        <li>آمار public تقریبی است و برای accounting دقیق طراحی نشده است.</li>
        <li>callbackهای خیلی قدیمی ممکن است بعد از prune شدن refها دیگر کار نکنند.</li>
        <li>پیام‌های unsupported قبل از encryption رد می‌شوند.</li>
        <li>secretها، ticketها و متن decryptشده نباید log شوند.</li>
      </ul>
    </section>

    <section class="border-t border-gray-200 pt-5">
      <h2 class="text-2xl font-semibold mb-4">منبع</h2>
      <p class="leading-8">
        کد و README فنی پروژه در
        <a href="https://github.com/mehotkhan/Nekonymous" class="text-blue-600 hover:text-blue-800 font-medium">GitHub</a>
        در دسترس است. اگر فقط می‌خواهی استفاده کنی، صفحهٔ <a href="/about" class="text-blue-600 hover:text-blue-800">راهنمای ساده</a>
        کافی است.
      </p>
    </section>
  </div>
`;
