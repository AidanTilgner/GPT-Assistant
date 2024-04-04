import Express, { Router } from "express";
import Assistant, {
  Channel,
  GlobalChannelMessage,
} from "@quasarbrains/assistant";
import routes from "./routes";
import axios from "axios";

/**
 * Represents the options for the Server class.
 */
export interface ServerOptions {
  assistant: Assistant; // The assistant instance to use.
  webhook_url: string; // The webhook URL the server channel will use to send messages.
  log?: boolean; // Indicates whether server logs should be enabled.
}

/**
 * Represents a server that handles HTTP requests.
 */
export default class Server {
  private router: Router;
  private log = true;
  private assistant: Assistant;
  private serverChannel: Channel;
  private serverHistory: Record<string, GlobalChannelMessage[]> = {
    test: [
      {
        role: "assistant",
        content: "Hello, how are you?",
      },
      {
        role: "user",
        content: "I'm good, how are you?",
      },
    ],
  };
  private webhook_url: string;

  /**
   * Creates a new instance of the Server class.
   * @param {ServerOptions} options - The server options.
   */
  constructor({ log, assistant, webhook_url }: ServerOptions) {
    this.router = Router();
    this.log = log || true;
    this.assistant = assistant;
    this.webhook_url = webhook_url;
    this.serverChannel = this.createServerChannel();
    this.init();
  }

  /**
   * Initializes the different routes for the server.
   */
  public init(): void {
    this.initRoutes();
    this.initServerChannel();
  }

  /**
   * Initializes routes
   */
  public initRoutes(): void {
    if (this.log) {
      console.info("Initializing server routes...");
    }

    this.router.use((req, res, next) => {
      if (!req.body) {
        req.body = {};
      }
      req.body.server = this;
      req.body.assistant = this.assistant;
      req.body.serverChannel = this.serverChannel;
      next();
    }, routes);

    if (this.log) {
      console.info("Server routes initialized.");
    }
  }

  public defineConversationHistory(
    conversation_id: string,
    messages: GlobalChannelMessage[]
  ): void {
    this.serverHistory[conversation_id] = messages;
  }

  public getConversationHistory(conversation_id: string, count?: number) {
    if (count) {
      return this.serverHistory[conversation_id].slice(-count);
    }
    return this.serverHistory[conversation_id] || [];
  }

  public getFullConversationHistory() {
    return this.serverHistory;
  }

  /**
   * creates the server channel
   */
  public createServerChannel(): typeof this.serverChannel {
    const serverChannel = new Assistant.Channel({
      name: "server",
      description:
        "Sets up a server and uses a combination of webhooks and a REST API to facilitate communication between the user and the assistant.",
      init: () => {},
      sendMessage: (message) => {
        axios.post(this.webhook_url, {
          message: "Your message has been processed.",
          data: {
            ...message,
          },
        });
        return message;
      },
      addToHistory: (history) => {
        this.serverHistory = {
          ...this.serverHistory,
          ...history,
        };
      },
      getFullHistory: () => {
        return this.serverHistory;
      },
      defineConversationHistory: (history) => {
        this.defineConversationHistory(
          history.conversationId,
          history.messages
        );
      },
      getConversationHistory: (conversation_id, count) => {
        return this.getConversationHistory(conversation_id, count);
      },
    });
    return serverChannel;
  }

  /**
   * Initializes the server channel.
   */
  public initServerChannel(): void {
    this.assistant.ChannelManager().registerChannel(this.serverChannel);
  }

  /**
   * Gets the router instance associated with the server.
   * @returns {Router} The router instance.
   */
  public Router(): Router {
    return this.router;
  }

  /**
   * Creates and configures an Express application with the server's router.
   * @returns {Express.Express} The configured Express application.
   */
  public Server(): Express.Express {
    const app = Express();

    app.use(Express.json());
    app.use(Express.urlencoded({ extended: true }));

    app.use(this.router);

    return app;
  }
}
