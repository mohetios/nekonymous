import { escapeHtml } from "../utils/tools";

const siteOrigin = (publicSiteUrl?: string): string | null => {
  const trimmed = publicSiteUrl?.trim().replace(/\/$/, "");
  return trimmed ? trimmed : null;
};

const pageUrl = (origin: string | null): string | null => origin;

const siteStructuredData = (
  BOT_NAME: string,
  origin: string | null
): string => {
  const data = origin
    ? {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: BOT_NAME,
        url: origin,
      }
    : {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: BOT_NAME,
      };

  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
};

const socialMeta = (title: string, BOT_NAME: string, origin: string | null) => {
  const url = pageUrl(origin);
  return `
      <meta property="og:title" content="${escapeHtml(title)}" />
      <meta property="og:description" content="${escapeHtml(BOT_NAME)} — رله پیام ناشناس برای Telegram با لینک شخصی، inbox، پاسخ ناشناس و مدل حریم خصوصی صادقانه." />
      <meta property="og:type" content="website" />
      ${url ? `<meta property="og:url" content="${escapeHtml(url)}" />` : ""}
      <meta property="og:locale" content="fa_IR" />
      <meta property="og:site_name" content="${escapeHtml(BOT_NAME)}" />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content="${escapeHtml(title)}" />
      <meta name="twitter:description" content="${escapeHtml(BOT_NAME)} — رله پیام ناشناس برای Telegram با لینک شخصی، inbox، پاسخ ناشناس و مدل حریم خصوصی صادقانه." />
      ${url ? `<link rel="canonical" href="${escapeHtml(url)}" />` : ""}
      ${siteStructuredData(BOT_NAME, origin)}`;
};

const pageLayout = (
  title: string,
  BOT_NAME: string,
  content: string,
  publicSiteUrl?: string
) => {
  const origin = siteOrigin(publicSiteUrl);
  const escapedTitle = escapeHtml(title);
  const escapedBotName = escapeHtml(BOT_NAME);

  return `
  <!doctype html>
  <html lang="fa">
    <head>
      <meta charset="utf-8" />
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0, user-scalable=no"
      />
      <link
        href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css"
        rel="stylesheet"
      />
      <link
        href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
        rel="stylesheet"
      />
      <title>${escapedTitle}</title>
      <meta name="description" content="${escapedBotName} — رله پیام ناشناس برای Telegram. لینک شخصی، inbox، پاسخ ناشناس، block و توضیح روشن درباره حریم خصوصی." />
      <meta name="keywords" content="ربات ناشناس, امنیت, پیام ناشناس, حریم خصوصی, ${escapedBotName}" />
      <meta name="robots" content="index, follow" />
      <meta name="author" content="ربات ${escapedBotName}" />
      ${socialMeta(title, BOT_NAME, origin)}
      <link rel="icon" href="/favicon.ico" />
      <meta name="theme-color" content="#317EFB"/>
      <style>
        body {
          direction: rtl;
          font-family: 
            Vazirmatn, 
            -apple-system, 
            BlinkMacSystemFont, 
            "Segoe UI", 
            "Roboto", 
            "Oxygen", 
            "Ubuntu", 
            "Cantarell", 
            "Fira Sans", 
            "Droid Sans", 
            "Helvetica Neue", 
            Arial, 
            sans-serif;
          background-color: #f8fafc;
        }

        a {
          color: #3182ce;
          text-decoration: none;
        }

        a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body class="bg-gray-50 antialiased">

      <main class="bg-white shadow-sm rounded-xl p-4 md:p-6 max-w-5xl mx-auto my-3 md:my-6 border border-gray-100">
      <nav class="bg-gray-100 p-4 rounded-lg mb-6 flex flex-col md:flex-row gap-3 md:justify-between md:items-center">
      <div>
        <a
          href="/"
          class="text-xl font-bold nav-link text-blue-700 hover:text-blue-900"
        >
        ${escapedBotName}
        </a>
        <span class="text-sm font-normal text-gray-600">
        ، ${escapedTitle}
        </span>
      </div>
      <div class="flex flex-wrap gap-3 text-sm">
        <a href="/about" class="nav-link text-blue-700 hover:text-blue-900">
          نحوه کار
        </a>
        <a href="/about/technical" class="nav-link text-blue-700 hover:text-blue-900">
          جزئیات فنی
        </a>
      </div>
    </nav>  
      <div class="text-gray-700 leading-relaxed">
          ${content}
        </div>
      </main>
    </body>
  </html>
`;
};

export default pageLayout;
