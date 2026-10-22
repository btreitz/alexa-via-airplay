import { BUILT_IN_INTENTS, PLAY_INTENT_SAMPLES } from "../constants.ts";
import { validateInvocationName } from "./invocation.ts";

export function interactionModel(invocationName: string): string {
  const model = {
    interactionModel: {
      languageModel: {
        invocationName: validateInvocationName(invocationName),
        intents: [
          { name: "PlayIntent", samples: PLAY_INTENT_SAMPLES },
          ...BUILT_IN_INTENTS.map((name) => ({ name, samples: [] })),
        ],
        types: [],
      },
    },
  };
  return `${JSON.stringify(model, null, 2)}\n`;
}
