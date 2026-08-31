export { localAIService } from "./local/LocalAIService";
export { localAIDetector } from "./local/LocalAIDetector";
export { localAICache } from "./local/LocalAICache";
export { getAIMode, setAIMode } from "./local/LocalAISettings";
export type { AIMode } from "./local/LocalAISettings";
export { classifyRequest, shouldUseLocal } from "./local/LocalAIClassifier";
export { routeMessage } from "./AIRouter";
export type { AIRouterSource, AIRouterResponse } from "./AIRouter";
