import { DurableObject } from "cloudflare:workers";
import type { Environment, InboxMessage } from "../types";

/**
 * Per-user inbox queue stored in a Durable Object.
 */
export class InboxDurableObject extends DurableObject<Environment> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { method } = request;

    switch (method) {
      case "POST":
        if (url.pathname === "/add") {
          return this.addMessage(request);
        }
        break;
      case "GET":
        if (url.pathname === "/counter") {
          return this.getMessageCount();
        }
        if (url.pathname === "/retrieve") {
          return this.retrieveAndClearInbox();
        }
        break;
    }

    return new Response("Not Found", { status: 404 });
  }

  private async addMessage(request: Request): Promise<Response> {
    const { timestamp, ticketId } = await request.json<InboxMessage>();
    const inbox =
      (await this.ctx.storage.get<InboxMessage[]>("inbox")) ?? [];
    inbox.push({ timestamp, ticketId });
    await this.ctx.storage.put("inbox", inbox);
    return new Response("Message added to inbox", { status: 200 });
  }

  private async getMessageCount(): Promise<Response> {
    const inbox =
      (await this.ctx.storage.get<InboxMessage[]>("inbox")) ?? [];
    return new Response(JSON.stringify(inbox), { status: 200 });
  }

  private async retrieveAndClearInbox(): Promise<Response> {
    const inbox =
      (await this.ctx.storage.get<InboxMessage[]>("inbox")) ?? [];
    await this.ctx.storage.delete("inbox");
    return new Response(JSON.stringify(inbox), { status: 200 });
  }
}
