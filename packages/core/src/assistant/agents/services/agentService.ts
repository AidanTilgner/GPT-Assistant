import { Service } from "../..";
import { Agent } from "../agent";

interface AgentServiceOptions {
  agent: Agent;
}

export default class AgentService extends Service {
  private agent: Agent;

  constructor({ agent }: AgentServiceOptions) {
    super({
      name: "agent-service",
      description:
        "A generic service for performing common actions such as recording to memory and others.",
      schema: {
        methods: [
          {
            name: "recordToContext",
            description: "record a key/value pair to the context",
            parameters: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "the key of the entry",
                },
                value: {
                  type: "string",
                  description: "the value of the entry",
                },
              },
              required: ["key", "value"],
            },
            performAction: (params: { key: string; value: string }) => {
              if (!params.key || !params.value) {
                return undefined;
              }
              return this.recordToContext({
                key: params.key,
                value: params.value,
              });
            },
          },
          {
            name: "markComplete",
            description: "Considers the task complete if it is complete.",
            parameters: {
              type: "object",
              properties: {
                complete: {
                  type: "boolean",
                  description:
                    "Mark this as true when you call the function, otherwise don't call the function",
                },
              },
              required: ["complete"],
            },
            performAction: () => {
              this.markComplete();
            },
          },
          {
            name: "markPaused",
            description: "Pause the process if need be",
            parameters: {
              type: "object",
              properties: {
                complete: {
                  type: "boolean",
                  description:
                    "Mark this as true when you call the function, otherwise don't call the function",
                },
              },
              required: ["complete"],
            },
            performAction: () => {
              this.markComplete();
            },
          },
          {
            name: "promptUser",
            description:
              "Send a message to the user and await a response which will appear in the next iteration's context",
            parameters: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "The message to send the user",
                },
              },
              required: ["message"],
            },
            performAction: (params: { message: string }) => {
              return this.promptUser(params);
            },
          },
        ],
      },
    });
    this.agent = agent;
  }

  public recordToContext({ key, value }: { key: string; value: string }) {
    this.agent.addToContext(key, value);
  }

  public markComplete() {
    this.agent.MarkComplete();
  }

  public markPaused() {
    this.agent.MarkPaused();
  }

  public promptUser({ message }: { message: string }) {
    if (!message || typeof message != "string") {
      return "Message sent by agent was invalid.";
    }
    return this.agent.promptUser(message);
  }
}
