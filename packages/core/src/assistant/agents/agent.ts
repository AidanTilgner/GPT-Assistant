import { AgentManager } from ".";
import { Channel, Service } from "..";
import { Module } from "../../types/main";
import { ChatModel } from "../llm";
import { randomBytes } from "crypto";
import { GlobalChannelMessage } from "../../types/main";
import AgentService from "./services/agentService";

export interface AgentOptions {
  name: string;
  model: ChatModel;
  primaryChannel: Channel;
  primaryConversationId: string;
  task: string;
  verbose?: boolean;
}

export class Agent {
  private name: string;
  private model: ChatModel;
  private manager: AgentManager | undefined;
  private primaryChannel: Channel;
  private primaryConversationId: string;
  private verbose: boolean;
  private agentContext: { [key: string]: string } = {};
  private agentService: Service;
  private task: string;
  private currentStep: number = 0;
  private userMessages: GlobalChannelMessage[] = [];
  private actionHistory: string[] = [];
  private paused: boolean = false;
  private awaitingUserMessage: boolean = false;
  private complete: boolean = false;

  constructor({
    name,
    model,
    primaryChannel,
    primaryConversationId,
    verbose,
    task,
  }: AgentOptions) {
    this.name = name;
    this.model = model;
    this.primaryChannel = primaryChannel;
    this.primaryConversationId = primaryConversationId;
    this.task = task;
    this.verbose = verbose ?? false;
    this.agentService = new AgentService({ agent: this });
    this.userMessages = [];
  }

  public static getRandomNewName() {
    const length = 8;
    const bytes = randomBytes(length);
    const asStr = bytes.toString("hex");
    const name = asStr.slice(0, length).toUpperCase();
    return name;
  }

  public Name(): string {
    return this.name;
  }

  public FormattedAgentName(): string {
    return `Agent ${this.Name()}`;
  }

  public PrimaryChannel(): Channel {
    return this.primaryChannel;
  }

  public MarkComplete() {
    this.complete = true;
  }

  public MarkPaused() {
    this.paused = true;
  }

  public getAgentConversationHistory(conversationId: string) {
    const history = this.primaryChannel.getAgentHistory(
      this.Name(),
      conversationId
    );
    return history;
  }

  public getAgentConversationHistoryAsString() {
    const history = this.primaryChannel.getAgentHistory(
      this.Name(),
      this.primaryConversationId
    );
    const str = history.reduce((acc, curr) => {
      return (acc += `- ${curr.role}: ${curr.content}\n"`);
    }, "");
    return str;
  }

  public registerManager(manager: AgentManager) {
    this.manager = manager;
  }

  public modulesAvailable(): Module[] {
    const services =
      this.manager?.Assistant()?.ServiceManager().getServiceList() ?? [];
    const channels =
      this.manager
        ?.Assistant()
        ?.ChannelManager()
        .getChannelList()
        .map((c) => {
          if (c.name === this.primaryChannel.Name()) {
            return {
              ...c,
              description: `(*PRIMARY CHANNEL) ${c.description}`,
            };
          }
          return c;
        }) ?? [];

    const others: Module[] = [
      {
        name: this.agentService.Name(),
        type: "service",
        description: this.agentService.Description(),
        schema: this.agentService.Schema(),
      },
    ];

    const modules = [...services, ...channels, ...others];

    const withUniqueNames = modules.map((m) => ({
      ...m,
      name: `${m.name}(${randomBytes(4).toString("hex")})`,
    }));

    return withUniqueNames;
  }

  public init(options?: { generate_name?: boolean }) {
    if (options?.generate_name) {
      const name = Agent.getRandomNewName();
      this.name = name;
    }
  }

  public start() {
    this.sendGreetingMessage();
    this.agentProcess();
  }

  public restart() {
    this.agentProcess();
  }

  public async sendPrimaryChannelMessage(
    message: string,
    type: GlobalChannelMessage["type"] = "text"
  ) {
    try {
      await this.primaryChannel.sendMessageAsAssistant(
        {
          content: `${this.FormattedAgentName()}: ${message}`,
          type,
        },
        this.primaryConversationId
      );
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  public async recieveMessage(conversationId: string) {
    try {
      const history = this.getAgentConversationHistory(conversationId);

      const lastMessage = history[history.length - 1];

      this.userMessages.push(lastMessage);
      if (this.awaitingUserMessage) {
        this.awaitingUserMessage = false;
        this.restart();
      }
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  public async promptUser(message: string) {
    try {
      this.awaitingUserMessage = true;
      this.sendPrimaryChannelMessage(message);
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

  public async sendGreetingMessage() {
    try {
      await this.sendPrimaryChannelMessage(
        `${this.FormattedAgentName()} has been initialized to complete the following task:
        "${JSON.stringify(this.task)}"
        `,
        "log"
      );
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  public addToContext(key: string, value: string) {
    this.agentContext[key] = value;
  }

  public getContextAsString() {
    let str = "";
    Object.keys(this.agentContext).forEach((key) => {
      str += `${key}: ${this.agentContext[key]}\n`;
    });
    return str;
  }

  public getActionHistoryAsString() {
    const str = this.actionHistory.reduce((acc, curr) => {
      return (acc += curr + "\n");
    }, "");

    return str;
  }

  public finish() {
    this.complete = true;
    if (this.verbose) {
      this.sendPrimaryChannelMessage(
        `${this.FormattedAgentName()} has finished.`,
        "log"
      );
      this.sendPrimaryChannelMessage(
        `Action history:\n${this.actionHistory.join("\n")}`,
        "log"
      );
    }
  }

  public async agentProcess(): Promise<boolean> {
    try {
      if (!this.task) {
        console.error("No task provided.");
        return false;
      }

      if (this.complete) {
        return true;
      }

      if (this.paused) {
        return false;
      }

      if (this.awaitingUserMessage) {
        return false;
      }

      const unreadMessages = this.userMessages;
      this.userMessages = [];

      const perception = `
        Here is some additional context for your reference:
        ---
        Agent Context:
        ${this.getContextAsString() || "No context yet."}
        ---
        These actions have been performed:
        ${
          this.getActionHistoryAsString() ||
          "No actions have been performed yet."
        }
        ---
        Message History:
        ${this.getAgentConversationHistoryAsString()}
        ---
        Unread messages:
        ${
          unreadMessages.length > 0
            ? unreadMessages.map((m) => m.content).join("\n")
            : "There are no unread messages."
        }
      `;

      if (this.verbose) {
        this.sendPrimaryChannelMessage(
          `Agent Perception: \n${perception}`,
          "log"
        );
      }

      const tools = this.model.modulesToTools(this.modulesAvailable());

      if (this.verbose) {
        this.sendPrimaryChannelMessage(
          `These tools have been provided to the agent:\n${this.modulesAvailable().map(
            (m) => {
              return m.schema.methods.reduce((acc, curr) => {
                return (acc += `- ${curr.name}: ${curr.description}\n`);
              }, "");
            }
          )}`,
          "log"
        );
      }

      const response = await this.model.getNextBestActionForTask(
        this.task,
        tools,
        perception
      );

      if (!response) {
        console.error("No response.");
        return false;
      }

      const { performAction, arguments: args, name, module_name } = response;
      const parsedArgs = { ...JSON.parse(args), agent: this.Name() };
      const namedAction = `${module_name}.${name}`;

      if (this.verbose) {
        this.sendPrimaryChannelMessage(
          `Selected "${namedAction}" as action`,
          "log"
        );
      }

      if (name === "usePrimaryChannel") {
        const message = parsedArgs.message;
        this.sendPrimaryChannelMessage(message);
        this.currentStep += 1;
        return this.agentProcess();
      }

      const output = await performAction(parsedArgs);
      const contextKey = `${this.currentStep}-${namedAction}`;
      this.actionHistory.push(
        `Performed action "${namedAction}" with arguments: ${args} and context key ${contextKey}.`
      );
      this.addToContext(contextKey, output);

      if (this.verbose) {
        this.sendPrimaryChannelMessage(
          `Performed action ${namedAction} with arguments ${JSON.stringify(
            args
          )} and output: ${output}`,
          "log"
        );
      }

      this.currentStep += 1;

      return this.agentProcess();
    } catch (error) {
      console.error(error);
      return false;
    }
  }
}
