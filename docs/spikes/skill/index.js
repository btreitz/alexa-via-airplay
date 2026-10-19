// Alexa-hosted skill for test B. It never calls home: every launch answers
// with AudioPlayer.Play for a fixed LAN URL. Paste into lambda/index.js.

const STREAM_URL = "https://soundbridge.trtz.dev/play.mp3";

function play(event) {
  const system = (event.context && event.context.System) || {};
  const deviceId = (system.device && system.device.deviceId) || "unknown";
  // Shortened device ID in the URL lets the server map Amazon's opaque ID to an Echo.
  const url = `${STREAM_URL}?d=${encodeURIComponent(deviceId.slice(-16))}&t=${Date.now()}`;
  return {
    version: "1.0",
    response: {
      shouldEndSession: true,
      directives: [
        {
          type: "AudioPlayer.Play",
          playBehavior: "REPLACE_ALL",
          audioItem: { stream: { url, token: `spike-${Date.now()}`, offsetInMilliseconds: 0 } },
        },
      ],
    },
  };
}

function stop() {
  return { version: "1.0", response: { shouldEndSession: true, directives: [{ type: "AudioPlayer.Stop" }] } };
}

function say(text) {
  return { version: "1.0", response: { shouldEndSession: true, outputSpeech: { type: "PlainText", text } } };
}

// AudioPlayer and PlaybackController requests must not contain speech.
const empty = { version: "1.0", response: {} };

exports.handler = async (event) => {
  const request = event.request || {};
  const intentName = request.intent && request.intent.name;
  console.log(JSON.stringify({ type: request.type, intent: intentName, error: request.error }));

  switch (request.type) {
    case "LaunchRequest":
    case "PlaybackController.PlayCommandIssued":
      return play(event);
    case "IntentRequest":
      switch (intentName) {
        case "PlayIntent":
        case "AMAZON.ResumeIntent":
        case "AMAZON.StartOverIntent":
          return play(event);
        case "AMAZON.PauseIntent":
        case "AMAZON.StopIntent":
        case "AMAZON.CancelIntent":
          return stop();
        case "AMAZON.HelpIntent":
          return say("This is the sound bridge test.");
        default:
          return say("That is not supported in this test.");
      }
    case "PlaybackController.PauseCommandIssued":
      return stop();
    default:
      // AudioPlayer.*, PlaybackController.Next/Previous, SessionEndedRequest,
      // System.ExceptionEncountered (logged above)
      return empty;
  }
};
