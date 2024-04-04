/* eslint-disable no-unused-vars */
import { ChannelManager } from ".";
import { GlobalChannelMessage, Module } from "../types/main";

export interface ChannelOptions {
  name: string;
  description: string;
  init: () => void;
  sendMessage: (message: GlobalChannelMessage, conversationId: string) => void;
  defineConversationHistory: (history: {
    conversationId: string;
    messages: GlobalChannelMessage[];
  }) => void;
  addToHistory: (history: Record<string, GlobalChannelMessage[]>) => void;
  getFullHistory: () => Record<string, GlobalChannelMessage[]>;
  getConversationHistory: (
    conversationId: string,
    count?: number
  ) => GlobalChannelMessage[];
}

export class Channel {
  private name: string;
  private description: string;
  private messageListeners: Array<
    (
      message: GlobalChannelMessage,
      sendMessage: (
        message: GlobalChannelMessage,
        conversationId: string
      ) => void
    ) => void
  > = [];
  private manager: ChannelManager | undefined;
  private sendMessage: (
    message: GlobalChannelMessage,
    conversationId: string
  ) => void;
  public init: () => void;
  public defineConversationHistory: (history: {
    conversationId: string;
    messages: GlobalChannelMessage[];
  }) => void;
  public getFullHistory: () => Record<string, GlobalChannelMessage[]>;
  public getConversationHistory: (
    conversationId: string,
    count?: number
  ) => GlobalChannelMessage[];

  constructor({
    name,
    description,
    init,
    sendMessage,
    defineConversationHistory,
    getFullHistory,
    getConversationHistory,
  }: ChannelOptions) {
    this.name = name;
    this.description = description;
    this.init = init;
    this.sendMessage = sendMessage;
    this.defineConversationHistory = defineConversationHistory;
    this.getFullHistory = getFullHistory;
    this.getConversationHistory = getConversationHistory;
  }

  public Name(): string {
    return this.name;
  }

  public Description(): string {
    return this.description;
  }

  public Manager(): ChannelManager | undefined {
    return this.manager;
  }

  public Schema(): Module["schema"] {
    return {
      methods: [
        {
          name: "get_conversation_history",
          description: "Returns the conversation history.",
          parameters: {
            type: "object",
            properties: {
              conversationId: {
                type: "string",
                description: "The conversation id.",
              },
              count: {
                type: "number",
                description: "The number of messages to return.",
              },
            },
            required: ["conversationId"],
          },
          performAction: (params: { conversationId: string; count?: number }) =>
            this.getConversationHistory(params.conversationId, params.count),
        },
        {
          name: "getFullHistory",
          description: "Returns the full history of the channel.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
          performAction: () => this.getFullHistory(),
        },
        {
          name: "sendMessage",
          description: "Sends a message to the channel.",
          parameters: {
            type: "object",
            properties: {
              message: {
                type: "object",
                description: "The message to send.",
                properties: {
                  content: {
                    type: "string",
                    description: "The content of the message.",
                  },
                },
              },
            },
            required: ["message"],
          },
          performAction: (params: { message: GlobalChannelMessage }) => {
            if (!params.message) {
              this.sendMessageAsAssistant(
                {
                  type: "text",
                  content: "An error occured when trying to send a message.",
                },
                "default"
              );
            }
            this.sendMessageAsAssistant(
              {
                ...params.message,
                type: "text",
              },
              "default"
            );
          },
        },
      ],
    };
  }

  public getActionsMap() {
    return {
      get_conversation_history: ({
        conversationId,
        count,
      }: {
        conversationId: string;
        count?: number;
      }) => this.getConversationHistory,
      get_full_history: this.getFullHistory,
      send_message: this.sendMessageAsAssistant,
    };
  }

  public async recieveMessage(
    message: GlobalChannelMessage,
    conversationId: string
  ): Promise<void> {
    this.defineConversationHistory({
      conversationId,
      messages: [...this.getConversationHistory(conversationId), message],
    });
    this.messageListeners.forEach((cb) =>
      cb(message, (msg: GlobalChannelMessage) =>
        this.sendMessage(msg, conversationId)
      )
    );
  }

  public async sendMessageAsAssistant(
    message: Omit<GlobalChannelMessage, "role">,
    conversationId: string
  ): Promise<void> {
    const newMessage = {
      ...message,
      role: "assistant" as const,
    };
    this.recieveMessage(newMessage, conversationId);
    return this.sendMessage(newMessage, conversationId);
  }

  public addMessageListener(
    cb: (
      message: GlobalChannelMessage,
      sendMessage: (
        message: GlobalChannelMessage,
        conversationId: string
      ) => void
    ) => void
  ): void {
    this.messageListeners.push(cb);
  }

  public registerManager(manager: ChannelManager): void {
    this.manager = manager;
  }

  /**
   * Recieves the message, sends it to the assistant, and records and sends the response.
   */
  public async startAssistantResponse({
    message,
    conversationId,
  }: {
    message: GlobalChannelMessage;
    conversationId: string;
  }): Promise<boolean> {
    try {
      this.recieveMessage(message, conversationId);
      const history = this.getConversationHistory(conversationId);
      const response = await this.manager?.Assistant()?.startAssistantResponse({
        messages: [...history],
        channel: this,
        conversationId,
      });

      return !!response;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  public getAgentHistory(agentName: string, conversationId: string) {
    const history = this.getConversationHistory(conversationId);
    const filteredHistory = history.filter(
      (message) => message.agent === agentName
    );
    return filteredHistory;
  }
}
