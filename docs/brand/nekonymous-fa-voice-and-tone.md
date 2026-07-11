# Nekonymous Persian Voice and Tone

This is the source of truth for Persian interaction copy in Nekonymous.

## Core Voice

Nekonymous is a young orange cat that carries anonymous messages. It speaks like a concise, internet-aware Persian speaker: warm, direct, slightly playful, and never childish.

The product keyword is:

```text
پیام ناشناس
```

Prefer clear product words:

```text
پیام ناشناس
لینک پیام ناشناس
صندوق پیام‌ها
پیام تازه
پاسخ ناشناس
نام خصوصی
مسدود کردن
گزارش کردن
ارزیابی سبک گفت‌وگو
پروفایل گفت‌وگو
پیشنهاد گفت‌وگو
درخواست گفت‌وگو
پیام شروع
نمایش در پیشنهادها
```

Do not use story-like UX terms such as «صندوقچه»، «در کوچک»، «پیک اسرار»، «اتاق اعتراف»، «مسیر جادویی»، or «رازخانه».

## Persian Register

Use controlled conversational Persian:

```text
تو
می‌تونی
نمی‌تونی
اگه
برات
همین‌جا
فعلاً
دوباره
با خودته
بهت خبر می‌دم
```

Avoid formal system language:

```text
کاربر گرامی
می‌باشد
می‌گردد
ثبت گردید
قابل قبول است
در حال حاضر امکان‌پذیر نمی‌باشد
لطفاً نسبت به انتخاب گزینه اقدام نمایید
```

Avoid short-lived slang:

```text
خفن
سم
فاز
کراش
ردفلگ
چیل
داداش
```

## Cat Reactions

Cat reactions are occasional, not a tic.

Use `میو،` for first greetings, warm returns, and soft positive starts.
Use `میو؟` for unclear input or light errors.
Use `میووو...` for waiting, empty inboxes, or no results.
Use `میو!` rarely, only for low-risk happy moments.

Do not use unfamiliar cat sounds such as `mrrp`, `مِروپ`, `پررر`, `هیس`, `میعویی`, or `مییی‌و`.

Most messages should not start with `میو`. Never use cat reactions in privacy, report, block, abuse, or account deletion copy.

## Emoji

The personality emoji is `🐾`. Use at most one decorative emoji per message. It is acceptable in low-risk success messages.

Do not use decorative emoji in privacy, report, block, abuse, or delete flows. Avoid `✨🔥😂🥹😍`.

## Tone Modes

Warm and character-led:
welcome, personal link, fresh message, empty inbox, assessment completion, request sent.

Neutral and functional:
compose prompts, replies, private nickname, pagination, profile status, assessment questions, request lists.

Calm error:
temporary failures, invalid links, expired requests, invalid input, limits.

Serious:
reports, blocking, privacy, account deletion, data deletion, abuse, serious failures. No jokes, no cat reactions, no decorative emoji.

## Privacy Claims

Never claim perfect anonymity, E2EE, zero-knowledge delivery, exact compatibility, clinical/personality diagnosis, dating compatibility, or secure messenger positioning.

Use clear limitation language:

```text
نِکونیموس پیام‌رسان رمزنگاری سرتاسری نیست و ناشناسی کامل رو تضمین نمی‌کنه.
تلگرام و سرور بات هنگام پردازش، متن پیام رو می‌بینن.
```

Stored sensitive data may be described as encrypted at rest only where implemented.

## Conversation Suggestions

Do not show compatibility percentages, quality labels, or matching language such as «مچ»، «درصد سازگاری»، «نزدیکی محدود»، or «سبک گفت‌وگوی خیلی نزدیک».

Suggestion explanations should show understandable reasons and, when useful, one possible difference:

```text
چیزهایی که بینتون نزدیکه:
• ریتم جواب‌دادنتون به هم نزدیکه.
• هر دوتون گفت‌وگوی عمیق‌تر رو دوست دارین.

یک تفاوت احتمالی:
• یکی‌تون معمولاً سریع‌تر جواب می‌ده.
```

Differences should not sound like warnings or problems.

## Assessment

Use «ارزیابی سبک گفت‌وگو», not «تست». The copy may explicitly say it is not a personality test or psychological diagnosis.

Do not hardcode the assessment question count in UI text. Import it from the canonical question bank/constants.

## Implementation Rules

Change visible copy, labels, placeholders, and language documentation only. Do not change commands, callback identifiers, callback prefixes, business logic, database schema, ranking formulas, scoring, rate limits, storage behavior, retention, or keyboard architecture while doing a voice pass.

Before merging copy changes, run targeted audits for forbidden formal phrases, matching terms, cat sounds, and privacy claims.
