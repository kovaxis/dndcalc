import { analyze, type CollectionAnalysis } from "./analyze";
import { Cache } from "./eval";

const ANALYZE_TIMEOUT = 10;

export interface AnalyzeMessage {
  type: "analyze";
  source: string;
  params: Record<string, number>;
}

export interface ResultMessage {
  type: "result";
  result: CollectionAnalysis;
}

export type WorkerMessage = AnalyzeMessage;

export type ResponseMessage = ResultMessage;

const cache = new Cache();

let pendingTimeout: null | number = null;
let pendingAnalysis: AnalyzeMessage | null = null;

function onAnalyzeTimeout() {
  pendingTimeout = null;
  const analyzeMsg = pendingAnalysis;
  pendingAnalysis = null;

  if (analyzeMsg) {
    const { source, params } = analyzeMsg;
    const result = analyze(source, new Map(Object.entries(params)), cache);
    const resultMsg: ResultMessage = {
      type: "result",
      result,
    };
    self.postMessage(resultMsg);
  }
}

function onAnalyze(msg: AnalyzeMessage) {
  if (pendingTimeout == null) {
    pendingTimeout = setTimeout(onAnalyzeTimeout, ANALYZE_TIMEOUT);
  }
  pendingAnalysis = msg;
}

self.addEventListener("message", (ev) => {
  const msg: unknown = ev.data;
  if (msg && typeof msg === "object" && "type" in msg) {
    switch (msg.type) {
      case "analyze":
        onAnalyze(msg as AnalyzeMessage);
    }
  }
});
