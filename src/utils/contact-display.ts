import { escapeMarkdownV2 } from "./tools";

export const buildDeliveryHeaderLine = (nickname: string): string =>
  `💬 از ${nickname}:`;

export const buildDeliveryHeader = (nickname: string): string =>
  `${buildDeliveryHeaderLine(nickname)}\n\n`;

export const buildDeliveryHeaderMarkdown = (nickname: string): string =>
  `${escapeMarkdownV2(buildDeliveryHeaderLine(nickname))}\n\n`;
