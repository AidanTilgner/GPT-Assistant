import { ChannelManager } from "../channels";
import { ServiceManager } from "../services";
import { Channel } from "../channels/construct";
import { OpenAIChatModel } from "./llm/chat";
import { Service } from "../services/construct";
import { Pipeline } from "./pipeline";
import { PlanOfAction } from "./agents/planofaction";
import { mkdirSync, writeFileSync } from "fs";
import { Agent } from "./agents/agent";
import { AgentManager } from "./agents";
import { GlobalChannelMessage } from "../types/main";

export type AvailableModels = OpenAIChatModel;

export interface AssistantOptions {
  // The name of the assistant.
  name: string;
  // The model to use for the assistant.
  model: AvailableModels;
  // The directory to store the assistant's data.
  datastoreDirectory: string;
  // A description of the assistant's personality and role
  description: string;
  // Whether to log assistant actions and metadata.
  log?: boolean;
  // Assistant responses will be complex and verbose, mostly useful for debugging.
  verbose?: boolean;
}

export { Service, Channel };

export default class Assistant {
  private name: string;
  private channelManager: ChannelManager;
  private serviceManager: ServiceManager;
  private agentManager: AgentManager;
  private model: AvailableModels;
  private pipeline: Pipeline;
  private datastoreDirectory: string;
  private log: boolean;
  private verbose: boolean;
  private description: string;
  public static Channel = Channel;
  public static Service = Service;
  public static PlanOfAction = PlanOfAction;
  public static Agent = Agent;
  public static ChatModels = {
    OpenAI: OpenAIChatModel,
  };

  constructor({
    name,
    model,
    datastoreDirectory,
    description,
    log,
    verbose,
  }: AssistantOptions) {
    this.name = name;
    this.model = model;
    this.datastoreDirectory = datastoreDirectory;
    this.description = description;
    this.verbose = verbose ?? false;
    this.log = log ?? true;
    this.channelManager = new ChannelManager({ assistant: this });
    this.serviceManager = new ServiceManager({ assistant: this });
    this.agentManager = new AgentManager({ assistant: this });
    this.pipeline = new Pipeline({ assistant: this, verbose: this.verbose });
    this.init();
  }

  public async init() {
    await this.initDatastore();
    await this.initChatModel();
    return true;
  }

  public Name(): string {
    return this.name;
  }

  public Verbosity(): boolean {
    return this.verbose;
  }

  public ChannelManager(): ChannelManager {
    return this.channelManager;
  }

  public ServiceManager(): ServiceManager {
    return this.serviceManager;
  }

  public AgentManager(): AgentManager {
    return this.agentManager;
  }

  public Model() {
    return this.model;
  }

  public Description() {
    return this.description;
  }

  public Pipeline() {
    return this.pipeline;
  }

  public DatastoreDirectory() {
    return this.datastoreDirectory;
  }

  public async initDatastore() {
    if (this.log) {
      console.info(`Initializing datastore at ${this.datastoreDirectory}`);
    }

    mkdirSync(this.datastoreDirectory, { recursive: true });
    mkdirSync(`${this.datastoreDirectory}/agents`, { recursive: true });
    mkdirSync(`${this.datastoreDirectory}/agents/records`, { recursive: true });
    mkdirSync(`${this.datastoreDirectory}/plansofaction`, { recursive: true });

    return this.datastoreDirectory;
  }

  public async initChatModel() {
    this.model.registerAssistant(this);
  }

  public recordToDatastore(
    path: string,
    record: string | NodeJS.ArrayBufferView
  ) {
    return writeFileSync(`${this.datastoreDirectory}/${path}`, record);
  }

  public async getChatResponseSimple(message: string): Promise<string> {
    try {
      const response = await this.model.getChatResponseSimple({
        message,
        system_prompt: "You are a helpful assistant.",
      });
      return response;
    } catch (error) {
      console.error(error);
      return "An error occured.";
    }
  }

  public async getChatResponse(
    messages: GlobalChannelMessage[]
  ): Promise<GlobalChannelMessage> {
    try {
      const response = await this.model.getChatResponse({
        messages,
      });
      return response;
    } catch (error) {
      console.error(error);
      return {
        role: "system",
        content: "An error occured.",
      };
    }
  }

  public async startAssistantResponse({
    messages,
    channel,
    conversationId,
  }: {
    messages: GlobalChannelMessage[];
    channel: Channel;
    conversationId: string;
  }): Promise<boolean> {
    try {
      const lastMessage = messages[messages.length - 1];
      if (
        this.agentManager.messageBelongsToAgent(lastMessage) &&
        lastMessage.agent
      ) {
        return this.agentManager.recieveAgentMessage(
          lastMessage.agent,
          conversationId
        );
      }

      const pipelineResponse = await this.pipeline.userMessage({
        messages,
        primaryChannel: channel,
        conversationId: conversationId,
      });

      return pipelineResponse;
    } catch (error) {
      console.error(error);
      return false;
    }
  }
}
