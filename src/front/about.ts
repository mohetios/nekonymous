export const AboutPageContent = () => `
  <div class="space-y-10">
    <section>
      <p class="text-sm text-blue-700 mb-2">راهنمای ساده برای کاربر</p>
      <h1 class="text-3xl font-bold mb-4">نِکونیموس چطور کار می‌کند؟</h1>
      <p class="text-lg leading-9 mb-4">
        نِکونیموس یک رله پیام ناشناس برای Telegram است. یعنی پیام از طریق bot عبور می‌کند
        تا صاحب لینک و فرستنده لازم نباشد username تلگرام همدیگر را در رابط ربات ببینند.
      </p>
      <p class="text-lg leading-9">
        ایده اصلی ساده است: لینک می‌گیری، دیگران از لینک پیام می‌فرستند، تو از /inbox می‌خوانی،
        و اگر خواستی از همان‌جا ناشناس پاسخ می‌دهی یا فرستنده را block می‌کنی.
      </p>
    </section>

    <section>
      <h2 class="text-2xl font-semibold mb-4">جریان کامل، بدون پیچیدگی فنی</h2>
      <div class="space-y-4">
        <div class="rounded-xl border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">۱. صاحب لینک شروع می‌کند</h3>
          <p class="leading-8">
            با /start یک لینک شخصی می‌گیرد. این لینک برای دریافت پیام است، نه نمایش username تلگرام.
          </p>
        </div>
        <div class="rounded-xl border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">۲. فرستنده از لینک وارد می‌شود</h3>
          <p class="leading-8">
            bot بررسی می‌کند لینک درست باشد، فرستنده خود صاحب لینک نباشد، block نشده باشد،
            و صاحب لینک دریافت پیام را pause نکرده باشد.
          </p>
        </div>
        <div class="rounded-xl border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">۳. پیام در inbox منتظر می‌ماند</h3>
          <p class="leading-8">
            پیام برای ذخیره‌سازی رمزنگاری می‌شود و در صندوق صاحب لینک قرار می‌گیرد.
            صاحب لینک با /inbox پیام‌های جدید را دریافت می‌کند.
          </p>
        </div>
        <div class="rounded-xl border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">۴. بعد از خواندن، کنترل‌ها فعال می‌مانند</h3>
          <p class="leading-8">
            متن پیام بعد از تحویل از payload ذخیره‌شده پاک می‌شود، اما ارتباط لازم برای پاسخ،
            block، unblock و nickname باقی می‌ماند.
          </p>
        </div>
      </div>
    </section>

    <section>
      <h2 class="text-2xl font-semibold mb-4">کارهایی که می‌توانی انجام بدهی</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="rounded-xl bg-gray-50 border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">دریافت و پاسخ</h3>
          <p class="leading-8">
            پیام‌های جدید را از /inbox می‌خوانی و می‌توانی بدون تبدیل گفتگو به چت مستقیم Telegram پاسخ بدهی.
          </p>
        </div>
        <div class="rounded-xl bg-gray-50 border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">block و pause</h3>
          <p class="leading-8">
            اگر فرستنده‌ای مزاحم بود block می‌کنی. اگر مدتی پیام جدید نمی‌خواهی، دریافت را pause می‌کنی.
          </p>
        </div>
        <div class="rounded-xl bg-gray-50 border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">nickname خصوصی</h3>
          <p class="leading-8">
            برای فرستنده‌های تکراری اسم خصوصی می‌گذاری تا خودت آن‌ها را بهتر بشناسی؛ این نام برای دیگران نمایش داده نمی‌شود.
          </p>
        </div>
        <div class="rounded-xl bg-gray-50 border border-gray-200 p-4">
          <h3 class="font-semibold mb-2">پاک کردن حساب</h3>
          <p class="leading-8">
            از تنظیمات می‌توانی لینک قبلی، inbox، block list و nicknameها را پاک کنی و لینک تازه بگیری.
          </p>
        </div>
      </div>
    </section>

    <section class="rounded-xl border border-yellow-200 bg-yellow-50 p-5">
      <h2 class="text-2xl font-semibold mb-4">حریم خصوصی، صادقانه</h2>
      <p class="leading-8 mb-3">
        نِکونیموس یک hosted anonymous relay است، نه یک پیام‌رسان end-to-end encrypted.
        یعنی در رابط bot، username دو طرف برای هم نمایش داده نمی‌شود و پیام‌ها در زمان ذخیره‌سازی رمزنگاری می‌شوند؛
        اما Telegram هنوز بخشی از مسیر پیام است و Worker هنگام پردازش، متن پیام را می‌بیند.
      </p>
      <p class="leading-8 mb-3">
        اگر کسی فقط به storage دسترسی داشته باشد و secret اصلی سیستم را نداشته باشد، نباید بتواند متن پیام‌ها را بخواند.
        اما اپراتوری که بتواند کد Worker را تغییر دهد یا به secretها برسد، بخشی از مدل اعتماد است.
      </p>
      <p class="leading-8">
        هدف نکونیموس این است: کم کردن plaintext ذخیره‌شده و کاهش نشت هویت قابل مشاهده برای کاربر،
        بدون اینکه relay پیچیده و سنگین شود.
      </p>
    </section>

    <section>
      <h2 class="text-2xl font-semibold mb-4">اگر جزئیات بیشتری می‌خواهی</h2>
      <p class="leading-8 mb-4">
        صفحهٔ فنی، همان جریان بالا را با کمی جزئیات بیشتر توضیح می‌دهد: پیام کجا ذخیره می‌شود،
        چرا inbox جداست، بعد از /inbox چه چیزی پاک می‌شود، و چه چیزهایی عمداً باقی می‌ماند.
      </p>
      <a
        href="/about/technical"
        class="inline-flex rounded-lg bg-gray-800 px-4 py-2 text-white hover:bg-gray-900 transition"
      >
        رفتن به نحوه کار و معماری
      </a>
    </section>

    <section class="border-t border-gray-200 pt-5">
      <h2 class="text-2xl font-semibold mb-4">متن‌باز</h2>
      <p class="leading-8">
        کد منبع روی
        <a href="https://github.com/mehotkhan/Nekonymous" class="text-blue-600 hover:text-blue-800 font-medium">گیت‌هاب</a>
        است. اگر می‌خواهی دقیق‌تر ببینی پشت relay چه می‌گذرد، می‌توانی کد و README را بررسی کنی.
      </p>
    </section>
  </div>
`;
