/** Strings with HTML tags must be sent via `replyHtml` / `withHtml` (parse_mode HTML). */
export const WelcomeMessage = `<b>نِکونیموس</b> — رله پیام ناشناس برای Telegram

<b>لینک شخصی شما:</b>
<code>UUID_USER_URL</code>

این لینک را به اشتراک بگذارید. فرستنده از داخل bot پیام می‌دهد و username تلگرام شما برای او نمایش داده نمی‌شود.

شما پیام‌ها را با /inbox می‌خوانید و می‌توانید ناشناس پاسخ دهید، block کنید، دریافت را pause کنید یا برای فرستنده nickname خصوصی بگذارید.

پیام‌های جدید: /inbox
تنظیمات: /settings`;

export const USER_LINK_MESSAGE = `<b>لینک ناشناس شما</b>

<code>UUID_USER_URL</code>

این لینک را در اختیار دیگران قرار دهید.
فرستنده از طریق bot پیام می‌دهد؛ username تلگرام شما برای او نمایش داده نمی‌شود.
شما پیام‌ها را از /inbox می‌خوانید و می‌توانید پاسخ دهید یا block کنید.

دریافت پیام‌ها: /inbox`;

const DRAFT_KEYBOARD_HINT = `برای لغو یا بازگشت: <b>↩️ لغو</b> · <b>⚙️ تنظیمات</b> · <b>🏠 بازگشت</b>`;

export const StartConversationMessage = `شما در حال ارسال پیام ناشناس به <b>USER_NAME</b> هستید.

متن پیام را ارسال کنید.
username تلگرام شما برای گیرنده نمایش داده نمی‌شود.
پیام برای ذخیره‌سازی رمزنگاری می‌شود، اما این bot end-to-end encrypted نیست.

${DRAFT_KEYBOARD_HINT}`;

export const HuhMessage = `خطایی رخ داد.

لطفاً دوباره تلاش کنید یا از منوی ربات استفاده کنید.
در صورت نیاز: /start`;

export const NoUserFoundMessage = `این لینک دیگر فعال نیست.

احتمالاً نادرست کپی شده یا مالک حساب آن را حذف کرده است.
لینک جدید را از مالک دریافت کنید.`;

export const NoConversationFoundMessage = `پاسخ به این پیام امکان‌پذیر نیست.

این دکمه قدیمی شده یا reference آن دیگر در inbox وجود ندارد.
برای ادامه، از /inbox و پیام‌های جدیدتر استفاده کنید.`;

export const MESSAGE_SENT_MESSAGE = `<b>پیام ارسال شد</b>

گیرنده می‌تواند آن را از طریق /inbox مشاهده کند.`;

export const USER_BLOCKED_MESSAGE = `<b>فرستنده بلاک شد</b>

این کاربر دیگر نمی‌تواند برای شما پیام ناشناس ارسال کند.`;

export const USER_UNBLOCKED_MESSAGE = `<b>فرستنده آنبلاک شد</b>

این کاربر می‌تواند دوباره از طریق لینک شما پیام ارسال کند.`;

export const REPLAY_TO_MESSAGE = `<b>پاسخ ناشناس</b>

متن پاسخ را ارسال کنید.
پیام به همان فرستنده می‌رسد و هویت شما محفوظ می‌ماند.

${DRAFT_KEYBOARD_HINT}`;

export const REPLAY_TO_NICKNAME_MESSAGE = `<b>پاسخ به NICKNAME</b>

متن پاسخ را ارسال کنید.
هویت شما برای گیرنده افشا نمی‌شود.

${DRAFT_KEYBOARD_HINT}`;

export const NICKNAME_PROMPT_MESSAGE = `<b>نام مستعار فرستنده</b>

نام فعلی: <b>CURRENT_NICK</b>

یک نام کوتاه ارسال کنید تا پیام‌های این فرستنده با آن نمایش داده شود.
برای حذف نام: <code>حذف</code> یا <code>−</code>

${DRAFT_KEYBOARD_HINT}`;

export const NICKNAME_SAVED_MESSAGE = `<b>نام مستعار ذخیره شد:</b> <b>NAME</b>

پیام‌های این فرستنده از این پس با این نام نمایش داده می‌شود.`;

export const NICKNAME_REMOVED_MESSAGE = `<b>نام مستعار حذف شد</b>

این فرستنده بدون برچسب نمایش داده می‌شود.`;

export const NICKNAME_LIMIT_MESSAGE = `ظرفیت نام‌های مستعار تکمیل شده است.

برای افزودن نام جدید، ابتدا از بخش تنظیمات چند مورد را حذف کنید.`;

export const NICKNAME_TEXT_ONLY_MESSAGE = `برای نام مستعار فقط <b>متن</b> قابل قبول است.

ارسال عکس، پیام صوتی و فایل پشتیبانی نمی‌شود.`;

export const RECIPIENT_PAUSED_MESSAGE = `<b>USER_NAME</b> در حال حاضر پیام ناشناس دریافت نمی‌کند.

لطفاً بعداً از همین لینک دوباره تلاش کنید.`;

export const OWNER_PAUSED_NOTE = `<b>دریافت پیام غیرفعال است.</b>

برای فعال‌سازی: تنظیمات → <b>فعال‌سازی دریافت</b>`;

export const USER_IS_BLOCKED_MESSAGE = `امکان ارسال پیام وجود ندارد.

مالک این لینک شما را بلاک کرده است.`;

export const ABOUT_PRIVACY_COMMAND_MESSAGE = `<b>درباره نِکونیموس</b>

نِکونیموس یک رله پیام ناشناس برای Telegram است.
لینک شخصی می‌گیرید؛ دیگران از همان لینک پیام می‌دهند؛ شما پیام‌ها را از /inbox می‌خوانید.

<b>در چند قدم</b>
۱. لینک شخصی را به اشتراک می‌گذارید.
۲. فرستنده از داخل bot پیام می‌فرستد.
۳. پیام در inbox شما منتظر می‌ماند.
۴. با /inbox می‌خوانید و می‌توانید پاسخ دهید، block کنید یا nickname خصوصی بگذارید.

<b>حریم خصوصی</b>
username تلگرام دو طرف در رابط bot نمایش داده نمی‌شود.
متن پیام قبل از ذخیره‌سازی رمزنگاری می‌شود.
بعد از تحویل، payload پیام از storage پاک می‌شود.

<b>محدودیت مهم</b>
نِکونیموس end-to-end encrypted نیست. Telegram پیام اولیه را دریافت می‌کند و Worker هنگام پردازش پیام، متن را می‌بیند. این سرویس برای کاهش نمایش هویت و plaintext ذخیره‌شده طراحی شده، نه برای ناشناس‌بودن مطلق.

<b>کنترل‌ها</b>
می‌توانید دریافت پیام جدید را pause کنید، فرستنده‌ها را block کنید، nickname خصوصی بگذارید یا حساب را reset کنید و لینک تازه بگیرید.

<b>جزئیات بیشتر</b>
در وب‌سایت: نحوه کار و جزئیات فنی.
در ربات: تنظیمات → <b>📐 معماری فنی</b>.`;

export const UnsupportedMessageTypeMessage = `این نوع پیام پشتیبانی نمی‌شود.

متن، عکس، ویدیو، پیام صوتی و استیکر قابل ارسال هستند. لطفاً قالب دیگری انتخاب کنید.`;

export const NEW_INBOX_MESSAGE = `<b>COUNT</b> پیام ناشناس جدید دارید.

برای مشاهده: /inbox`;

export const EMPTY_INBOX_MESSAGE = `<b>صندوق ورودی خالی است</b>

پیام خوانده‌نشده‌ای ندارید. لینک خود را به اشتراک بگذارید تا پیام دریافت کنید.`;

export const YOUR_MESSAGE_SEEN_MESSAGE = `گیرنده پیام شما را مشاهده کرد.`;

export const RATE_LIMIT_MESSAGE = `لطفاً کمی صبر کنید.

پس از چند ثانیه می‌توانید دوباره پیام ارسال کنید.`;

export const INBOX_FULL_MESSAGE = `صندوق ورودی گیرنده پر است.

در حال حاضر امکان ارسال پیام وجود ندارد. لطفاً بعداً تلاش کنید.`;

export const SELF_MESSAGE_DISABLE_MESSAGE = `ارسال پیام ناشناس به خودتان امکان‌پذیر نیست.

لینک سایر کاربران را باز کنید.`;
