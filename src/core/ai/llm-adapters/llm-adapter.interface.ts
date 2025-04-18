export interface LLMGenerateResponse {
  // Renamed from LLMResponse
  config: any; // Consider defining a more specific type if possible
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
    model: string; // Added model parameter
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<LLMGenerateResponse>; // Updated return type
}
