import type { Environment } from "../types";
import { KVModel } from "../utils/kv-storage";
import { getTotalStats } from "../utils/logs";

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
  const statsModel = new KVModel<number>("stats", env.NekonymousKV);
  const stats = await getTotalStats(statsModel);

  // GitHub repository information
  const githubOwner = "mehotkhan";
  const githubRepo = "Nekonymous";
  const githubUrl = `https://github.com/${githubOwner}/${githubRepo}`;

  let commitHash = "N/A";
  let commitDate = "N/A";
  let commitMessage = "N/A";
  let commitUrl = githubUrl;

  // Fetch the latest commit from GitHub
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
    commitHash = commitData.sha.substring(0, 7); // Shortened commit hash
    commitDate = new Date(commitData.commit.author.date).toLocaleDateString();
    commitMessage = commitData.commit.message.split("\n")[0]; // Extract first line of commit message
    commitUrl = commitData.html_url; // URL to the specific commit on GitHub
  }

  return `
    <div class="max-w-4xl mx-auto p-6">
      <h1 class="text-3xl font-bold text-center mb-8">
        به ${env.BOT_NAME} خوش آمدید
      </h1>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div class="bg-blue-100 p-6 rounded-lg shadow-lg text-center">
          <h2 class="text-xl font-bold text-blue-700 mb-2">کاربران</h2>
          <p   class="text-lg text-blue-600">
            ${stats.usersCount}
          </p>
        </div>
        <div class="bg-green-100 p-6 rounded-lg shadow-lg text-center">
          <h2 class="text-xl font-bold text-green-700 mb-2">تعداد مکالمات</h2>
          <p  class="text-lg text-green-600">
           ${stats.conversationsCount}
          </p>
        </div>
      </div>

      <p class="text-lg leading-relaxed mb-4">
        نِکونیموس  به شما این امکان را می‌دهد که به صورت ناشناس و امن با دیگر
        کاربران چت کنید. این ربات با استفاده از تکنولوژی‌های پیشرفته و رمزنگاری
        مدرن توسعه داده شده است تا حریم خصوصی شما را به بهترین نحو ممکن حفظ کند.
      </p>
      <p class="text-lg leading-relaxed mb-4">
        برای شروع، کافی است روی دکمه زیر کلیک کنید تا به ربات وارد شوید. ربات به
        صورت خودکار یک لینک یکتا برای شما تولید می‌کند که می‌توانید آن را با
        دیگران به اشتراک بگذارید و مکالمات خود را آغاز کنید.
      </p>
      <div class="text-center mb-10 py-10">
        <a
          href="https://t.me/nekonymous_bot?start"
          class="inline-block bg-blue-600 text-white text-xl font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-blue-700 transition"
        >
          شروع به استفاده از ربات
        </a>
      </div>

      <!-- Footer Section -->
      <footer class="text-center mt-10 border-t pt-4">
       <p class="text-sm text-gray-600">
          <a href="${githubUrl}" class="underline">GitHub Repository</a> | 
          <a href="${commitUrl}" class="underline">Latest Commit: ${commitHash} on ${commitDate}</a><br />
          Commit Message: ${commitMessage}
        </p>
      </footer>

 
    </div>
  `;
};
