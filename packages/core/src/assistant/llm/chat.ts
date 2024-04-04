import OpenAI from "openai";
import { ChatModel } from ".";
import {
  AgentDispatchList,
  GlobalChannelMessage,
  Module,
  ModuleMethod,
} from "../../types/main";

export type AllowedOpenAIChatModels =
  OpenAI.ChatCompletionCreateParams["model"];

export type Tool = OpenAI.ChatCompletionTool & { method: ModuleMethod };

export interface OpenAIOptions {
  apiKey: string;
  agentModel?: AllowedOpenAIChatModels;
  planningModel?: AllowedOpenAIChatModels;
  baseURL?: string;
}

export class OpenAIChatModel extends ChatModel<Tool> {
  private client: OpenAI;
  private agentModel: AllowedOpenAIChatModels;
  private planningModel: string;
  public static readonly DEFAULT_AGENT_MODEL = "gpt-4";
  public static readonly DEFAULT_PLANNING_MODEL = "gpt-4";

  constructor({ apiKey, agentModel, planningModel, baseURL }: OpenAIOptions) {
    super();
    this.agentModel = agentModel || OpenAIChatModel.DEFAULT_AGENT_MODEL;
    this.planningModel =
      planningModel || OpenAIChatModel.DEFAULT_PLANNING_MODEL;
    this.client = new OpenAI({
      apiKey,
      ...((baseURL && { baseURL }) || {}),
    });
  }

  public AgentModel() {
    return this.agentModel;
  }

  public PlanningModel() {
    return this.planningModel;
  }

  public getCleanedMessages(messages: GlobalChannelMessage[]) {
    return messages.map((m) => ({ content: m.content, role: m.role }));
  }

  public modulesToTools(modules: Module[]): Tool[] {
    const tools: Tool[] = [];

    modules.forEach((m) => {
      m.schema.methods.forEach((method) => {
        tools.push({
          type: "function",
          function: {
            name: method.name,
            description: method.description,
            parameters:
              method.parameters as OpenAI.ChatCompletionTool["function"]["parameters"],
          },
          method,
        });
      });
    });

    return tools;
  }

  public async getChatResponseSimple({
    message,
    system_prompt,
  }: {
    message: string;
    system_prompt: string;
  }): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.agentModel,
        messages: [
          {
            role: "system",
            content: system_prompt,
          },
          {
            role: "user",
            content: message,
          },
        ],
      });

      const content = response.choices[0].message?.content;

      if (!content) {
        return "An error occured.";
      }

      return content;
    } catch (error) {
      console.error(error);
      return "An error occured.";
    }
  }

  public async getChatResponse({
    messages,
  }: {
    messages: GlobalChannelMessage[];
  }): Promise<GlobalChannelMessage> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.agentModel,
        messages: this.getCleanedMessages(messages),
      });

      const content = response.choices[0].message?.content;

      if (!content) {
        return {
          role: "assistant",
          content: "An error occured.",
        };
      }

      return {
        role: "assistant",
        content,
      };
    } catch (error) {
      console.error(error);
      return {
        role: "assistant",
        content: "An error occured.",
      };
    }
  }

  public async makeBooleanDecision(
    decisionDescription: string
  ): Promise<{ decision: boolean; reason: string } | undefined> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.PlanningModel(),
        messages: [
          {
            role: "system",
            content: `
            You are a decision maker. Based on the given description of the decision to be made, you will output a boolean value of true or false.
            `,
          },
          {
            role: "user",
            content: `
            Here is the description of the decision to be made:
            ${decisionDescription}
            `,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "boolean_decision",
              parameters: {
                type: "object",
                properties: {
                  decision: {
                    type: "boolean",
                    description: "The boolean yes or no decision.",
                  },
                  reason: {
                    type: "string",
                    description: "The reason for the decision.",
                  },
                },
                required: ["decision", "reason"],
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: {
            name: "boolean_decision",
          },
        },
      });

      if (!response) {
        return undefined;
      }

      const tc = response.choices[0].message.tool_calls?.[0];

      if (!tc) {
        return undefined;
      }

      const {
        function: { arguments: args },
      } = tc;

      if (!args) {
        return undefined;
      }

      const parsedArgs = JSON.parse(args);

      return parsedArgs as {
        decision: boolean;
        reason: string;
      };
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

  public async makeSelectionDecision<T extends number | string>(
    decisionDescription: string,
    options: { label: string; value: T }[]
  ): Promise<{ decision: T; reason: string } | undefined> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.PlanningModel(),
        messages: [
          {
            role: "system",
            content: `
              You are a decision maker.
              Based on the given description of the decision to be made, you will output the value corresponding to the selected option.
              The value could be either a number or a string.
            `,
          },
          {
            role: "user",
            content: `
            Here is the description of the decision to be made:
            ${decisionDescription}

            Here are the options to choose from:
            ${options
              .map((option) => {
                return `- ${option.value}: ${option.label}`;
              })
              .join("\n")}
            `,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "give_selection_decision",
              description:
                "Returns a decision object based on a selection input.",
              parameters: {
                type: "object",
                properties: {
                  decision: {
                    anyOf: [
                      {
                        type: "number",
                      },
                      {
                        type: "string",
                      },
                    ],
                    description:
                      "The value corresponding to the correct option.",
                  },
                  reason: {
                    type: "string",
                    description: "The reason for the decision.",
                  },
                },
                required: ["decision", "reason"],
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: {
            name: "give_selection_decision",
          },
        },
      });

      if (!response) {
        return undefined;
      }

      const tc = response.choices[0].message?.tool_calls?.[0];

      if (!tc) {
        return undefined;
      }

      const {
        function: { arguments: args },
      } = tc;

      if (!args) {
        return undefined;
      }

      const parsedArgs = JSON.parse(args);

      return parsedArgs as {
        decision: T;
        reason: string;
      };
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

  public async getAgentDispatchList(
    prompt: string
  ): Promise<AgentDispatchList | undefined> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.PlanningModel(),
        messages: [
          {
            role: "system",
            content: `
            # Purpose
            Based on the prompt given to you, you're tasked with dispatching agents to respond as effeciently as possible.

            # Context
            An agent is capable of performing a task using tools and its own context.
            You can dispatch as many agents as required to respond optimally to the prompt.
            However, you should attempt to be efficient in dispatch, balancing parallelism with speed.
            Keep in mind that agents can't collaborate, so a task given to an agent needs to be able to be accomplished by that agent alone.
            Each task you delegate will dispatch an individual agent.

            # Rules
            - Dispatch as efficiently as possible.
            - Some steps in tasks depend on eachother, keep this in mind.
            `,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        tool_choice: {
          type: "function",
          function: {
            name: "dispatchAgents",
          },
        },
        tools: [
          {
            type: "function",
            function: {
              name: "dispatchAgents",
              parameters: {
                type: "object",
                properties: {
                  agents: {
                    type: "array",
                    description: "The agents to be delegated.",
                    items: {
                      type: "object",
                      properties: {
                        task: {
                          type: "string",
                          description: "The task for this agent to complete.",
                        },
                      },
                      required: ["task"],
                    },
                  },
                },
                required: ["agents"],
              },
            },
          },
        ],
      });

      if (!response) {
        return undefined;
      }

      const tc = response.choices[0].message.tool_calls?.[0];

      if (!tc) {
        return undefined;
      }

      const {
        function: { arguments: args },
      } = tc;

      if (!args) {
        return undefined;
      }

      const parsedArgs = JSON.parse(args);
      return parsedArgs as AgentDispatchList;
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

  public async getNextBestActionForTask(
    task: string,
    tools: Tool[],
    additionalInfo: string
  ): Promise<(ModuleMethod & { arguments: string }) | undefined> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.PlanningModel(),
        messages: [
          {
            role: "system",
            content: `
            # Purpose
            You are an agent attempting to perform a task.
            Given a task, as well as additional information such as previous actions and context
            your goal is to take the next best action to complete the task.
            Given a description of an action to take, you should select the best tool to perform the action.
            If no tool is suitable for the action, you should ask for clarification from the user.
            If the action history indicates that the task has been accomplished, mark it as complete.

            RULES: 
            - Always use tools
            - Mark complete as soon as the task has been accomplished
            `,
          },
          {
            role: "user",
            content: `
            The task is as follows:
            ---
            ${task}
            ---
            `,
          },
          {
            role: "user",
            content: `
            Here is some additional information to help you complete the task:
            ${additionalInfo}
            `,
          },
        ],
        tools,
      });

      if (!response) {
        return undefined;
      }

      const tc = response.choices[0].message.tool_calls?.[0];
      const message = response.choices[0].message.content;

      if (!tc) {
        if (message) {
          return {
            name: "usePrimaryChannel",
            description: "Notify the user using the primary channel.",
            arguments: JSON.stringify({
              message,
            }),
            parameters: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "The message to send to the user.",
                },
              },
              required: ["message"],
            },
            performAction: () => {},
          } satisfies ModuleMethod & { arguments: string };
        }
        return undefined;
      }

      const {
        function: { arguments: args, name },
      } = tc;

      if (!args || !name) {
        return undefined;
      }

      const foundMethod = tools.find((t) => t.function.name === name);

      if (!foundMethod) {
        return undefined;
      }

      const parsedArgs = JSON.parse(args);

      return {
        ...foundMethod.method,
        arguments: JSON.stringify(parsedArgs),
      };
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }
}
