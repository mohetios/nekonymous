/**
 * KVModel provides an abstraction layer over Cloudflare's KV storage.
 */
export class KVModel<T = unknown> {
  public namespace: string;
  private kv: KVNamespace;

  constructor(namespace: string, kv: KVNamespace) {
    this.namespace = namespace;
    this.kv = kv;
  }

  private generateKey(id: string): string {
    return `${this.namespace}:${id}`;
  }

  async save(id: string, data: T, expiresIn?: number): Promise<void> {
    const key = this.generateKey(id);
    const expiration = expiresIn
      ? Math.floor(Date.now() / 1000) + expiresIn
      : undefined;
    await this.kv.put(key, JSON.stringify(data), { expiration });
  }

  async get(id: string): Promise<T | null> {
    const key = this.generateKey(id);
    const data = await this.kv.get(key);
    return data ? (JSON.parse(data) as T) : null;
  }

  async updateField(
    id: string,
    field: keyof T,
    value: unknown,
    push = false
  ): Promise<void> {
    const record = await this.get(id);

    if (!record || typeof record !== "object" || record === null) {
      throw new Error(`Record with ID ${id} not found.`);
    }

    const mutableRecord = record as Record<keyof T, unknown>;
    const currentValue = mutableRecord[field];

    if (push) {
      if (value === undefined || value === null) {
        console.warn("Attempted to push an invalid value:", value);
        return;
      }

      if (
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0
      ) {
        console.warn("Attempted to push an empty object:", value);
        return;
      }

      if (Array.isArray(currentValue)) {
        currentValue.push(value);
      } else {
        mutableRecord[field] = [value];
      }
    } else {
      mutableRecord[field] = value;
    }

    await this.save(id, record);
  }

  async popItemFromField(
    id: string,
    field: keyof T,
    value: unknown
  ): Promise<void> {
    const record = await this.get(id);

    if (!record || typeof record !== "object" || record === null) {
      throw new Error(`Record with ID ${id} not found.`);
    }

    const mutableRecord = record as Record<keyof T, unknown>;
    const currentValue = mutableRecord[field];

    if (!Array.isArray(currentValue)) {
      throw new Error(`Field ${String(field)} is not an array.`);
    }

    mutableRecord[field] = currentValue.filter((item) => item !== value);
    await this.save(id, record);
  }

  async list(
    options: { prefix?: string } = {}
  ): Promise<{ keys: { name: string }[]; values: T[] }> {
    const keys = await this.kv.list({
      prefix: options.prefix
        ? `${this.namespace}:${options.prefix}`
        : `${this.namespace}:`,
    });

    const values: T[] = [];
    for (const key of keys.keys) {
      const id = key.name.split(":").pop();
      if (!id) {
        continue;
      }

      const value = await this.get(id);
      if (value !== null) {
        values.push(value);
      }
    }

    return { keys: keys.keys, values };
  }
}
