import { type Controller, createController } from "./controller";
import type { CreateControllerOptions } from "./types";

export type ControllerHubEntry = CreateControllerOptions & {
  id: string;
};

export type ControllerHubOptions = {
  controllers?: ControllerHubEntry[];
};

export class ControllerHub {
  private readonly controllers = new Map<string, Controller>();

  async add(options: ControllerHubEntry): Promise<Controller> {
    if (this.controllers.has(options.id)) {
      throw new Error(`Controller ${options.id} already exists`);
    }

    const controller = await createController(options);
    this.controllers.set(options.id, controller);
    return controller;
  }

  get(id: string): Controller {
    const controller = this.controllers.get(id);
    if (!controller) {
      throw new Error(`Controller ${id} does not exist`);
    }
    return controller;
  }

  has(id: string): boolean {
    return this.controllers.has(id);
  }

  list(): string[] {
    return [...this.controllers.keys()];
  }

  states() {
    return Object.fromEntries(
      [...this.controllers.entries()].map(([id, controller]) => [
        id,
        controller.getState(),
      ]),
    );
  }

  async disconnectAll(): Promise<void> {
    await Promise.all(
      [...this.controllers.values()].map((controller) =>
        controller.disconnect(),
      ),
    );
    this.controllers.clear();
  }
}

export async function createControllerHub(
  options: ControllerHubOptions = {},
): Promise<ControllerHub> {
  const hub = new ControllerHub();
  for (const controller of options.controllers ?? []) {
    await hub.add(controller);
  }
  return hub;
}
