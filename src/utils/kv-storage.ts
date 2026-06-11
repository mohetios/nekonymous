export class KVModel<T = unknown> {
  public namespace: string;
  private kv: KVNamespace;

  constructor(namespace: string, kv: KVNamespace) {
    this.namespace = namespace;
    this.kv = kv;
  }

  private key(id: string): string {
    return `${this.namespace}:${id}`;
  }

  async save(id: string, data: T, expiresIn?: number): Promise<void> {
    const expiration = expiresIn
      ? Math.floor(Date.now() / 1000) + expiresIn
      : undefined;
    await this.kv.put(this.key(id), JSON.stringify(data), { expiration });
  }

  async get(id: string): Promise<T | null> {
    const value = await this.kv.get(this.key(id), "json");
    return (value as T | null) ?? null;
  }

  async remove(id: string): Promise<void> {
    await this.kv.delete(this.key(id));
  }

  async saveText(id: string, text: string, expiresIn?: number): Promise<void> {
    const expiration = expiresIn
      ? Math.floor(Date.now() / 1000) + expiresIn
      : undefined;
    await this.kv.put(this.key(id), text, { expiration });
  }

  async getText(id: string): Promise<string | null> {
    return this.kv.get(this.key(id));
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
