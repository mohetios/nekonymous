/**
 * Shared helpers for static verify scripts under tools/.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

export const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    fail(message);
  }
};

export const readRepoFile = (relativePath: string): string =>
  readFileSync(`${repoRoot}/${relativePath}`, "utf8");

export const assertIncludes = (
  content: string,
  needle: string,
  message: string
): void => {
  if (!content.includes(needle)) {
    fail(message);
  }
};

export const assertNotIncludes = (
  content: string,
  needle: string,
  message: string
): void => {
  if (content.includes(needle)) {
    fail(message);
  }
};
