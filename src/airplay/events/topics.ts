import { RAW_METADATA_CODE, TOPIC_PREFIX } from "../constants.ts";

export function topicFor(receiverId: string): string {
  return `${TOPIC_PREFIX}/${receiverId}`;
}

export function remoteTopicFor(receiverId: string): string {
  return `${topicFor(receiverId)}/remote`;
}

export function parseTopic(topic: string): [string, string] | null {
  const [prefix, receiver, first, second, ...rest] = topic.split("/");
  if (prefix !== TOPIC_PREFIX || !receiver || rest.length > 0) return null;
  if (second === undefined) return first ? [receiver, first] : null;
  if (RAW_METADATA_CODE.test(first) && RAW_METADATA_CODE.test(second)) {
    return [receiver, `${first}/${second}`];
  }
  return null;
}
