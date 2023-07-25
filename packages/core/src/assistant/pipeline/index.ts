import Assistant from "..";
import { Channel, GlobalChannelMessage } from "../../channels/construct";
import { Agent } from "../agents/agent";

export interface PipelineOptions {
  assistant: Assistant;
  agent?: Agent;
  verbose?: boolean;
}

export type ResponseModes = "converse" | "action";

export class Pipeline {
  private assistant: Assistant;
  private agent: Agent | undefined;
  private verbose: boolean = false;

  constructor({ assistant, verbose, agent }: PipelineOptions) {
    this.assistant = assistant;
    this.verbose = verbose ?? false;
    this.agent = agent;
  }

  public Assistant() {
    return this.assistant;
  }

  public async decideResponseMode(
    messages: GlobalChannelMessage[]
  ): Promise<ResponseModes | null> {
    try {
      const decision = await this.Assistant()
        .Model()
        .makeSelectionDecision(
          `
        Based on the following messages, you should decide whether or not an action needs to be taken.
        Basically, if the user is asking you to do something, or an action is implied to be taken, then an action should be taken.
        Choosing action will allow the system to parse the user's request and generate a plan of action.
        If the user is just making a statement, or being otherwise conversational, and there's no implication of an action, don't choose action.
        This will allow the system to parse the user's message and generate a response.

        ${messages
          .map((message) => {
            return `- ${message.content}`;
          })
          .join("\n")}
        `,
          [
            {
              label: "An action SHOULD NOT be taken.",
              value: "converse",
            },
            {
              label: "An action SHOULD be taken.",
              value: "action",
            },
          ]
        );
      return decision?.decision as ResponseModes;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  public async respondBasedOnMode({
    messages,
    mode,
    primaryChannel,
    conversationId,
  }: {
    messages: GlobalChannelMessage[];
    mode: ResponseModes;
    primaryChannel: Channel;
    conversationId: string;
  }) {
    try {
      switch (mode) {
        case "action":
          const planOfAction = await this.assistant
            ?.Model()
            .generatePlanOfAction(messages);

          if (!planOfAction) {
            return false;
          }
          if (this.verbose) {
            primaryChannel.sendMessageAsAssistant(
              {
                content:
                  "Plan of action generated..." +
                  "\n" +
                  planOfAction.Describe(),
              },
              conversationId
            );
            primaryChannel.sendMessageAsAssistant(
              {
                content: "Creating new agent...",
              },
              conversationId
            );
          }
          const newAgent = this.assistant.AgentManager().registerAgent(
            new Assistant.Agent({
              name: Assistant.Agent.getRandomNewName(),
              model: this.assistant?.Model(),
              planOfAction,
              primaryChannel,
              primaryConversationId: conversationId,
              verbose: this.verbose,
            })
          );
          if (this.verbose) {
            primaryChannel.sendMessageAsAssistant(
              {
                content: "Agent created, initializing...",
              },
              conversationId
            );
          }
          this.Assistant()?.AgentManager().initAndStartAgent(newAgent.Name());
          return true;
        case "converse":
          const response = await this.assistant
            ?.Model()
            .getChatResponse({ messages });
          if (!response) {
            return false;
          }
          primaryChannel.sendMessageAsAssistant(response, conversationId);
          return true;
        default:
          return false;
      }
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  public async userMessage({
    messages,
    primaryChannel,
    conversationId,
  }: {
    messages: GlobalChannelMessage[];
    primaryChannel: Channel;
    conversationId: string;
  }) {
    try {
      if (!this.assistant?.Model()) {
        return false;
      }

      const responseMode = await this.decideResponseMode(messages);

      if (this.verbose) {
        primaryChannel.sendMessageAsAssistant(
          {
            content: "Response mode: " + responseMode,
          },
          conversationId
        );
      }

      return this.respondBasedOnMode({
        messages,
        mode: responseMode ?? "converse",
        primaryChannel,
        conversationId,
      });
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  public responseAsAgentBasedOnMode({ mode }: { mode: ResponseModes }) {
    if (!this.agent) {
      throw new Error("No agent found.");
    }

    try {
      switch (mode) {
        case "action":
          return this.agent?.getActionResponse();
        case "converse":
          return this.agent?.getConversationalResponse();
        default:
          return false;
      }
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  public async userMessageToAgent({
    messages,
  }: {
    messages: GlobalChannelMessage[];
  }) {
    try {
      if (!this.assistant?.Model()) {
        throw new Error("No model found.");
      }

      if (!this.agent) {
        throw new Error("No agent found.");
      }

      const responseMode = await this.decideResponseMode(messages);

      if (this.verbose) {
        this.agent.sendPrimaryChannelMessage("Response mode: " + responseMode);
      }

      return this.responseAsAgentBasedOnMode({
        mode: responseMode ?? "converse",
      });
    } catch (error) {
      console.error(error);
      return false;
    }
  }
}
