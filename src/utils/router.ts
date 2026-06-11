import type { Environment, Handler } from "../types";

/**
 * A simple Router class to handle HTTP routes in a Cloudflare Worker environment.
 */
export class Router {
  private routes: { method: string; path: RegExp; handler: Handler }[] = [];

  get(path: string, handler: Handler): void {
    this.addRoute("GET", path, handler);
  }

  post(path: string, handler: Handler): void {
    this.addRoute("POST", path, handler);
  }

  addRoute(method: string, path: string, handler: Handler): void {
    const pathRegex = new RegExp(`^${path.replace(/:[^\s/]+/g, "([\\w-]+)")}$`);
    this.routes.push({ method, path: pathRegex, handler });
  }

  async handle(
    request: Request,
    env: Environment,
    ctx: ExecutionContext
  ): Promise<Response> {
    const { pathname } = new URL(request.url);
    const method = request.method;

    for (const route of this.routes) {
      const match = pathname.match(route.path);
      if (match && method === route.method) {
        return route.handler(request, env, ctx);
      }
    }

    return new Response("Not Found", { status: 404 });
  }
}
