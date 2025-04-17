export interface LLMResponse {
  config: any;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ModelOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface LLMAdapter {
  generate(options: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<LLMResponse>;
}
