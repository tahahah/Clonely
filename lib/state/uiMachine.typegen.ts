
  // This file was automatically generated. Edits will be overwritten

  export interface Typegen0 {
        '@@xstate/typegen': true;
        internalEvents: {
          "xstate.init": { type: "xstate.init" };
        };
        invokeSrcNameMap: {
          
        };
        missingImplementations: {
          actions: "cancelChat" | "disableInput" | "enableInput" | "focusInput" | "sendChat" | "startLiveService" | "stopLiveService";
          delays: never;
          guards: never;
          services: never;
        };
        eventsCausingActions: {
          "cancelChat": "ESC";
"clearError": "ESC" | "MIC_STOP" | "xstate.init";
"clearReply": "ESC" | "MIC_STOP" | "xstate.init";
"disableInput": "SUBMIT";
"enableInput": "API_ERROR" | "API_SUCCESS" | "ESC" | "MIC_STOP" | "OPEN_CHAT" | "xstate.init";
"focusInput": "API_ERROR" | "API_SUCCESS" | "ESC" | "MIC_STOP" | "OPEN_CHAT" | "xstate.init";
"sendChat": "SUBMIT";
"setError": "API_ERROR" | "LIVE_ERROR";
"setReply": "API_SUCCESS";
"startLiveService": "MIC_START";
"stopLiveService": "MIC_STOP";
        };
        eventsCausingDelays: {
          
        };
        eventsCausingGuards: {
          "canStartLive": "MIC_START";
        };
        eventsCausingServices: {
          
        };
        matchesStates: "activeIdle" | "chat" | "chat.error" | "chat.idle" | "chat.loading" | "live" | "live.error" | "live.loading" | "live.streaming" | { "chat"?: "error" | "idle" | "loading";
"live"?: "error" | "loading" | "streaming"; };
        tags: never;
      }
  