import { escapeMarkdownV2 } from "../../utils/text";
import { DELIVERY_HEADER_FROM } from "../../i18n/labels";

export const buildDeliveryHeaderLine = (nickname: string): string =>
  DELIVERY_HEADER_FROM(nickname);

export const buildDeliveryHeader = (nickname: string): string =>
  `${buildDeliveryHeaderLine(nickname)}\n\n`;

export const buildDeliveryHeaderMarkdown = (nickname: string): string =>
  `${escapeMarkdownV2(buildDeliveryHeaderLine(nickname))}\n\n`;
