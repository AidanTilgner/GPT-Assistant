/* eslint-disable no-unused-vars */
import Assistant from "..";
import {
  DiscreteActionDerivedFromMessage,
  DiscreteActionsGrouped,
  GlobalChannelMessage,
  Module,
  ModuleMethod,
} from "../../types/main";

export abstract class ChatModel<Tool = unknown> {
  private assistant: Assistant | undefined;

  public Assistant() {
    return this.assistant;
  }

  public registerAssistant(assistant: Assistant) {
    this.assistant = assistant;
  }

  public abstract getCleanedMessages(messages: GlobalChannelMessage[]): any[];

  public abstract getChatResponseSimple({
    message,
    system_prompt,
  }: {
    message: string;
    system_prompt: string;
  }): Promise<string>;

  public abstract getChatResponse({
    messages,
  }: {
    messages: GlobalChannelMessage[];
  }): Promise<GlobalChannelMessage>;

  public abstract modulesToTools(modules: Module[]): Tool[];

  public abstract makeBooleanDecision(
    decisionDescription: string
  ): Promise<{ decision: boolean; reason: string } | undefined>;

  public abstract makeSelectionDecision<T extends number | string>(
    decisionDescription: string,
    options: { label: string; value: T }[]
  ): Promise<{ decision: T; reason: string } | undefined>;

  public abstract getDiscreteActions(
    prompt: string
  ): Promise<DiscreteActionsGrouped | undefined>;

  public abstract getActionToPerformForDiscreteAction(
    discreteAction: DiscreteActionDerivedFromMessage,
    tools: Tool[],
    additionalInfo: string
  ): Promise<
    | (ModuleMethod & {
        arguments: string;
      })
    | undefined
  >;
}
