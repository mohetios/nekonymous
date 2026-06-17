import type { Environment } from "../types";
import { getPublicStats } from "../features/messaging/conversation-summary-service";
import { escapeHtml, convertToPersianNumbers } from "../utils/tools";
import { buildUserDeepLink } from "../utils/user";

interface GitHubCommitResponse {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      date: string;
    };
  };
}

export const HomePageContent = async (env: Environment) => {
  const stats = await getPublicStats(env);

  const githubOwner = "mehotkhan";
  const githubRepo = "Nekonymous";
  const githubUrl = `https://github.com/${githubOwner}/${githubRepo}`;
  const botLink = buildUserDeepLink(env.BOT_USERNAME);
  const botName = escapeHtml(env.BOT_NAME);

  let commitHash = "N/A";
  let commitDate = "N/A";
  let commitMessage = "N/A";
  let commitUrl = githubUrl;

  try {
    const commitInfo = await fetch(
      `https://api.github.com/repos/${githubOwner}/${githubRepo}/commits/master`,
      {
        headers: {
          "User-Agent": "Cloudflare Worker",
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (commitInfo.ok) {
      const commitData: GitHubCommitResponse = await commitInfo.json();
      commitHash = commitData.sha.substring(0, 7);
      commitDate = new Date(commitData.commit.author.date).toLocaleDateString(
        "fa-IR"
      );
      commitMessage = commitData.commit.message.split("\n")[0];
      commitUrl = commitData.html_url;
    }
  } catch {
    // Home page should stay available even if GitHub metadata is unavailable.
  }

  return `
    <section class="space-y-10">
      <div class="rounded-2xl bg-gray-900 text-white p-6 md:p-8">
        <p class="text-sm text-blue-200 mb-3">پیام ناشناس و مچ‌یابی ناشناس در Telegram</p>
        <h1 class="text-3xl md:text-4xl font-bold leading-tight mb-4">
          ${botName}
        </h1>
        <p class="text-lg md:text-xl leading-9 text-gray-100 mb-6">
          لینک شخصی می‌گیری، پیام ناشناس دریافت می‌کنی، تست سبک گفت‌وگو را کامل می‌کنی،
          و اگر خودت بخواهی وارد مچ‌یابی ناشناس می‌شوی؛ بدون نمایش username تلگرام دو طرف در رابط ربات.
        </p>
        <div class="flex flex-col sm:flex-row gap-3">
          <a
            href="${escapeHtml(botLink)}"
            class="inline-flex items-center justify-center rounded-lg bg-blue-500 px-5 py-3 text-base font-semibold text-white hover:bg-blue-600 transition"
          >
            شروع در Telegram
          </a>
          <a
            href="/about"
            class="inline-flex items-center justify-center rounded-lg border border-gray-500 px-5 py-3 text-base font-semibold text-white hover:bg-gray-800 transition"
          >
            ببین چطور کار می‌کند
          </a>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div class="rounded-xl border border-blue-100 bg-blue-50 p-5">
          <p class="text-sm text-blue-700 mb-1">کاربران ساخته‌شده</p>
          <p class="text-3xl font-bold text-blue-900">${escapeHtml(convertToPersianNumbers(stats.usersCount))}</p>
        </div>
        <div class="rounded-xl border border-green-100 bg-green-50 p-5">
          <p class="text-sm text-green-700 mb-1">پیام‌های ناشناس</p>
          <p class="text-3xl font-bold text-green-900">${escapeHtml(convertToPersianNumbers(stats.conversationsCount))}</p>
        </div>
        <div class="rounded-xl border border-purple-100 bg-purple-50 p-5">
          <p class="text-sm text-purple-700 mb-1">پروفایل‌های تست</p>
          <p class="text-3xl font-bold text-purple-900">${escapeHtml(convertToPersianNumbers(stats.testProfilesCount))}</p>
        </div>
        <div class="rounded-xl border border-indigo-100 bg-indigo-50 p-5">
          <p class="text-sm text-indigo-700 mb-1">آماده مچ‌یابی</p>
          <p class="text-3xl font-bold text-indigo-900">${escapeHtml(convertToPersianNumbers(stats.discoverableProfilesCount))}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <p class="text-sm text-gray-600 mb-1">درخواست‌های مچ</p>
          <p class="text-3xl font-bold text-gray-900">${escapeHtml(convertToPersianNumbers(stats.matchRequestsCount))}</p>
        </div>
      </div>

      <section>
        <h2 class="text-2xl font-bold mb-4">نکونیموس در چند قدم</h2>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="rounded-xl border border-gray-200 p-4">
            <p class="text-sm font-bold text-gray-500 mb-2">۱</p>
            <h3 class="font-semibold mb-2">لینک می‌گیری</h3>
            <p class="text-sm leading-7 text-gray-600">
              با /start یک لینک شخصی دریافت می‌کنی و آن را هر جایی که لازم است می‌گذاری.
            </p>
          </div>
          <div class="rounded-xl border border-gray-200 p-4">
            <p class="text-sm font-bold text-gray-500 mb-2">۲</p>
            <h3 class="font-semibold mb-2">دیگران پیام می‌دهند</h3>
            <p class="text-sm leading-7 text-gray-600">
              فرستنده لینک را باز می‌کند و پیام یا media پشتیبانی‌شده را داخل ربات ارسال می‌کند.
            </p>
          </div>
          <div class="rounded-xl border border-gray-200 p-4">
            <p class="text-sm font-bold text-gray-500 mb-2">۳</p>
            <h3 class="font-semibold mb-2">از inbox می‌خوانی</h3>
            <p class="text-sm leading-7 text-gray-600">
              پیام‌های جدید در صندوق تو منتظر می‌مانند و با /inbox تحویل داده می‌شوند.
            </p>
          </div>
          <div class="rounded-xl border border-gray-200 p-4">
            <p class="text-sm font-bold text-gray-500 mb-2">۴</p>
            <h3 class="font-semibold mb-2">اگر خواستی مچ می‌گیری</h3>
            <p class="text-sm leading-7 text-gray-600">
              تست سبک گفت‌وگو را کامل می‌کنی و با opt-in، پیشنهادهای ناشناس برای شروع گفتگو می‌گیری.
            </p>
          </div>
        </div>
      </section>

      <section class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="rounded-xl border border-gray-200 p-5">
          <h2 class="text-xl font-bold mb-3">رله پیام ناشناس</h2>
          <p class="text-sm leading-7 text-gray-700">
            پیام‌ها قبل از ذخیره رمزنگاری می‌شوند، بعد از /inbox payload پاک می‌شود، و reply، block، report و nickname با reference داخلی ادامه پیدا می‌کنند.
          </p>
        </div>
        <div class="rounded-xl border border-gray-200 p-5">
          <h2 class="text-xl font-bold mb-3">تست سبک گفت‌وگو</h2>
          <p class="text-sm leading-7 text-gray-700">
            تست درباره مرزها، عمق، انرژی اجتماعی و ترجیح‌های ارتباطی است. نتیجه برای شناخت سبک گفتگوست، نه تشخیص روان‌شناسی.
          </p>
        </div>
        <div class="rounded-xl border border-gray-200 p-5">
          <h2 class="text-xl font-bold mb-3">مچ‌یابی opt-in</h2>
          <p class="text-sm leading-7 text-gray-700">
            تا وقتی فعال نکنی، در جست‌وجوی مچ‌ها ظاهر نمی‌شوی. پیشنهادها ناشناس‌اند و گفتگو فقط با پذیرش طرف مقابل شروع می‌شود.
          </p>
        </div>
      </section>

      <section class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="rounded-xl border border-gray-200 p-5">
          <h2 class="text-xl font-bold mb-3">چه چیزی محافظت می‌شود؟</h2>
          <ul class="space-y-2 text-sm leading-7 text-gray-700">
            <li>فرستنده و گیرنده username تلگرام همدیگر را در ربات نمی‌بینند.</li>
            <li>متن پیام قبل از ذخیره‌شدن رمزنگاری می‌شود.</li>
            <li>بعد از تحویل، متن پیام از payload ذخیره‌شده پاک می‌شود.</li>
            <li>مچ‌یابی فقط با اجازه کاربر فعال می‌شود و نتیجه کامل تست نمایش داده نمی‌شود.</li>
          </ul>
        </div>
        <div class="rounded-xl border border-yellow-200 bg-yellow-50 p-5">
          <h2 class="text-xl font-bold mb-3">چه چیزی را ادعا نمی‌کند؟</h2>
          <ul class="space-y-2 text-sm leading-7 text-yellow-900">
            <li>این سیستم end-to-end encrypted نیست.</li>
            <li>Telegram همچنان پیام‌های bot را دریافت می‌کند، چون این یک ربات تلگرام است.</li>
            <li>Worker هنگام پردازش پیام، متن را می‌بیند و بعد برای storage رمز می‌کند.</li>
            <li>تست تشخیص پزشکی نیست و مچ‌یابی تضمین سازگاری یا رابطه نمی‌دهد.</li>
          </ul>
        </div>
      </section>

      <section class="rounded-xl border border-gray-200 bg-gray-50 p-5">
        <h2 class="text-2xl font-bold mb-3">برای چه کسی مناسب است؟</h2>
        <p class="leading-8 mb-4">
          برای وقتی که می‌خواهی دریافت پیام ناشناس ساده داشته باشی، سبک گفت‌وگوی خودت را بهتر بشناسی،
          و شاید با چند پیشنهاد ناشناس وارد گفت‌وگوی تازه شوی. نِکونیموس خودش را پیام‌رسان امن کامل،
          شبکه اجتماعی بزرگ یا ابزار تشخیص روان‌شناسی معرفی نمی‌کند.
        </p>
        <div class="flex flex-col sm:flex-row gap-3">
          <a href="/about" class="inline-flex justify-center rounded-lg bg-gray-800 px-4 py-2 text-white hover:bg-gray-900 transition">
            راهنمای ساده
          </a>
          <a href="/about/technical" class="inline-flex justify-center rounded-lg border border-gray-300 px-4 py-2 text-gray-800 hover:bg-white transition">
            نحوه کار و جزئیات فنی
          </a>
        </div>
      </section>

      <footer class="border-t border-gray-200 pt-5 text-sm leading-7 text-gray-600">
        <p>
          کد منبع:
          <a href="${escapeHtml(githubUrl)}" class="font-medium">GitHub Repository</a>
        </p>
        <p>
          آخرین commit:
          <a href="${escapeHtml(commitUrl)}" class="font-medium">${escapeHtml(commitHash)}</a>
          <span>در ${escapeHtml(commitDate)}</span>
        </p>
        <p>پیام commit: ${escapeHtml(commitMessage)}</p>
      </footer>
    </section>
  `;
};
