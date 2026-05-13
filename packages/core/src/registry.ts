import type { LanguageAdapter } from "@codewiz/sdk";

export type AdapterFactory = () => LanguageAdapter;

export class AdapterRegistry {
  private factories = new Map<string, AdapterFactory>();

  register(name: string, factory: AdapterFactory): void {
    this.factories.set(name, factory);
  }

  create(name: string): LanguageAdapter {
    const f = this.factories.get(name);
    if (!f) throw new Error(`unknown adapter: ${name}`);
    return f();
  }

  list(): string[] {
    return [...this.factories.keys()];
  }
}
