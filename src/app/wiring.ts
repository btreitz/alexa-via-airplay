import type { EventBus } from "../airplay/event-bus.ts";
import type { Bridge } from "../bridge/bridge.ts";
import { SessionManager } from "../bridge/session/session-manager.ts";
import type { PublicServer } from "../public/public-server.ts";
import type { SkillReport, StreamEvent } from "../public/types.ts";
import { SESSION_TICK_MS, WARM_UP_EVENTS } from "./constants.ts";

export function createSessions(bridge: Bridge, events: EventBus): SessionManager {
  return new SessionManager({
    receiver: (id) => bridge.receiverById(id),
    trigger: (serial) => bridge.triggerEcho(serial),
    stop: (serial) => bridge.stopEcho(serial),
    setVolume: (serial, percent) => bridge.alexa.setVolume(serial, percent),
    remote: (id, command) => events.remote(id, command),
    settings: () => bridge.store.get(),
    canControl: () => bridge.alexa.ready,
    testing: (serial) => bridge.testing(serial),
    endStream: (id) => bridge.receiverById(id)?.stream.dropAll(),
    allowStream: (serial) => bridge.allowStream(serial),
  });
}

export function wireSessions(
  bridge: Bridge,
  publicServer: PublicServer,
  events: EventBus,
  sessions: SessionManager,
): void {
  bridge.sessions = sessions;
  bridge.on("receiver-added", (receiver) => {
    sessions.track(receiver.id);
    receiver.input.on("active", () => sessions.onAudio(receiver.id));
  });
  bridge.on("receiver-removed", (receiver) => sessions.forget(receiver.id));
  publicServer.on("stream-open", (event: StreamEvent) => sessions.onStreamOpen(event.receiverId));
  publicServer.on("stream-close", (event: StreamEvent) => sessions.onStreamClose(event.receiverId));
  publicServer.on("skill-event", (report: SkillReport) =>
    bridge.skillReport(report.serial, report.event),
  );
  events.on("event", (receiver: string, event: string, payload: string) => {
    if (WARM_UP_EVENTS.has(event)) bridge.alexa.keepWarm();
    sessions.onEvent(receiver, event, payload);
  });
  setInterval(() => sessions.tick(), SESSION_TICK_MS).unref();
}
