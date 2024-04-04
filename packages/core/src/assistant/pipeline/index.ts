import Assistant from "..";
import { Channel } from "../../channels/construct";
import { GlobalChannelMessage } from "../../types/main";
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
      const agentsToDispatch = await this.Assistant()
        .Model()
        .getAgentDispatchList(messages[messages.length - 1].content);

      if (!agentsToDispatch) {
        primaryChannel.sendMessageAsAssistant(
          {
            content: "No agents to dispatch.",
            type: "log",
          },
          conversationId
        );
        return false;
      }

      agentsToDispatch.agents.forEach(async (a) => {
        const agent = await this.Assistant()
          ?.AgentManager()
          ?.dispatchAgent(a, primaryChannel, conversationId);

        if (this.verbose) {
          console.info("Dispatched agent for task: ", a.task, agent?.Name());
          primaryChannel.sendMessageAsAssistant(
            {
              content: `Dispatched agent for task: ${
                a.task
              }, with name: "${agent?.Name()}"`,
              type: "log",
            },
            conversationId
          );
        }
      });

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }
}
