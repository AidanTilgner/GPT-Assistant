import { JSONSchema } from "./jsonschema";

export type GlobalChannelMessage = {
  content: string;
  role: "system" | "user" | "assistant";
  agent?: string;
  type?: "text" | "callout" | "log";
};

export interface ModuleMethod {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: {
      [key: string]: JSONSchema;
    };
    required: string[];
  };
  // eslint-disable-next-line no-unused-vars
  performAction: (params: any) => any;
}

export interface Module {
  type: "service" | "channel" | "other";
  name: string;
  description: string;
  schema: {
    methods: ModuleMethod[];
  };
}

export type ModuleList = Module[];

export type DiscreteActionGroup = {
  name: string;
  actions: DiscreteActionDerivedFromMessage[];
};

export type DiscreteActionsGrouped = {
  groups: DiscreteActionGroup[];
};

export interface DiscreteAction {
  defined: string;
}

export type DiscreteActionDerivedFromMessage = DiscreteAction & {
  source_text: string;
};
