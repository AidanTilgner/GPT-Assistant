import Assistant from "..";
import { GlobalChannelMessage } from "../../channels/construct";
import { Agent } from "./agent";

export interface AgentManagerOptions {
  assistant: Assistant;
}

export class AgentManager {
  private agents: {
    [key: string]: Agent;
  } = {};
  private assistant: Assistant | undefined;

  constructor({ assistant }: AgentManagerOptions) {
    this.agents = {};
    this.assistant = assistant;
  }

  public Assistant(): Assistant | undefined {
    return this.assistant;
  }

  public registerAgent(agent: Agent) {
    if (this.agents[agent.Name()]) {
      throw new Error(`Agent with name ${agent.Name()} already exists.`);
    }
    agent.registerManager(this);
    this.agents[agent.Name()] = agent;
    return agent;
  }

  public registerAgents(agents: Agent[]) {
    agents.forEach((agent) => {
      this.registerAgent(agent);
    });
    return this.agents;
  }

  public initAndStartAgent(agentName: string) {
    const agent = this.agents[agentName];
    if (!agent) {
      throw new Error(`Agent with name ${agentName} not found.`);
    }
    agent.initAndStart();
  }

  public getAgent(agentName: string): Agent {
    return this.agents[agentName];
  }

  public getAllAgentsDescribed() {
    const descriptions = Object.values(this.agents).map((agent) => {
      return `- ${agent.Name()}: ${agent.getPlanOfAction().Describe()}`;
    });

    return descriptions;
  }

  public pauseAgent(agentName: string) {
    this.agents[agentName].pause();
  }

  public resumeAgent(agentName: string) {
    this.agents[agentName].resume();
  }

  public pauseAllAgents() {
    Object.values(this.agents).forEach((agent) => {
      agent.pause();
    });
  }

  public async killAgent(agentName: string) {
    try {
      await this.agents[agentName].kill("ABORTED");
      delete this.agents[agentName];
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  public messageBelongsToAgent(message: GlobalChannelMessage) {
    try {
      const messageAgent = message.agent;
      if (!messageAgent || !this.agents[messageAgent]) {
        return false;
      }
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  public recieveAgentMessage(message: GlobalChannelMessage) {
    try {
      const messageAgent = message.agent;
      if (!messageAgent || !this.agents[messageAgent]) {
        return false;
      }
      this.agents[messageAgent].recieveMessage();
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }
}
