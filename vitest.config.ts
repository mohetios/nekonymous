import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    include: ["test/**/*.test.ts"],
    poolOptions: {
      workers: {
        wrangler: {
          configPath: "./wrangler.types.jsonc",
        },
        miniflare: {
          bindings: {
            SECRET_TELEGRAM_API_TOKEN: "test-telegram-token",
            BOT_SECRET_KEY: "test-bot-secret",
            APP_MASTER_KEY: "dGVzdC1tYXN0ZXIta2V5MTIzNDU2Nzg5MDEyMzQ1Ng==",
            APP_HMAC_PEPPER: "test-hmac-pepper",
            BOT_INFO: JSON.stringify({
              id: 1,
              is_bot: true,
              first_name: "Test",
              username: "test_bot",
              can_join_groups: true,
              can_read_all_group_messages: false,
              supports_inline_queries: false,
            }),
            BOT_NAME: "Test Bot",
            BOT_USERNAME: "test_bot",
          },
        },
      },
    },
  },
});
