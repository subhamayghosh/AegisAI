import { useEffect, useRef, useState } from "react";
import * as firewallApi from "../api/firewall";
import { inspectionStages } from "../components/InspectionConsole";
import { INSPECTION_QUOTES } from "../inspectionQuotes";

const MIN_INSPECTION_FEEDBACK_MS = 650;

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export default function useInspectionRunner(toast) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [consoleEntries, setConsoleEntries] = useState([]);
  const [progressStep, setProgressStep] = useState(0);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const progressTimer = useRef(null);
  const quoteTimer = useRef(null);
  const stages = inspectionStages();

  useEffect(() => () => {
    window.clearInterval(progressTimer.current);
    window.clearInterval(quoteTimer.current);
  }, []);

  const startConsole = ({ demoStepInfo = null, scenario = null } = {}) => {
    window.clearInterval(progressTimer.current);
    window.clearInterval(quoteTimer.current);
    const demoHeader = demoStepInfo
      ? `demo: scenario ${demoStepInfo.index + 1}/${demoStepInfo.total} · ${scenario.label} · ${scenario.source_type}`
      : null;
    setConsoleEntries([
      "$ aegis inspect --live-trace",
      ...(demoHeader ? [demoHeader] : []),
      "$ authenticated request accepted",
      `${stages[0][0]}: ${stages[0][2]}`,
    ]);
    setProgressStep(0);
    setQuoteIndex(0);
    let nextStep = 0;
    progressTimer.current = window.setInterval(() => {
      if (nextStep >= stages.length - 1) {
        window.clearInterval(progressTimer.current);
        return;
      }
      nextStep += 1;
      const stageIndex = nextStep;
      const stageEntry = `${stages[stageIndex][0]}: ${stages[stageIndex][2]}`;
      setProgressStep(stageIndex);
      setConsoleEntries((items) => [...items, stageEntry]);
    }, 720);
    quoteTimer.current = window.setInterval(() => {
      setQuoteIndex((index) => (index + 1) % INSPECTION_QUOTES.length);
    }, 4200);
  };

  const stopConsole = (response, error = false) => {
    window.clearInterval(progressTimer.current);
    window.clearInterval(quoteTimer.current);
    const flaggedSignals = response?.tier_signals?.filter((signal) => signal.flagged) ?? [];
    const signalSummary = flaggedSignals.length
      ? flaggedSignals.map((signal) => `${signal.tier} ${Math.round(signal.confidence * 100)}%`).join(" · ")
      : "no tier flagged";
    setProgressStep(stages.length);
    setConsoleEntries((items) => [
      ...items,
      error
        ? "request: closed with an error; no unverified decision shown"
        : `decision: ${response.final_decision} · ${response.latency_ms_total}ms · audit hash recorded`,
      ...(error ? [] : [`signals: ${signalSummary}`, `models: ${response.working_model_id} → ${response.judge_model_id}`]),
    ]);
  };

  const inspectPayload = async ({
    payloadText,
    requestSourceType,
    metadata = {},
    requestSessionId = null,
    requestTurnId = 1,
    demoStepInfo = null,
    scenario = null,
    notify = true,
  }) => {
    setSubmitting(true);
    setResult(null);
    startConsole({ demoStepInfo, scenario });
    const startedAt = performance.now();
    try {
      const response = await firewallApi.inspect({
        input_id: crypto.randomUUID(),
        session_id: requestSessionId,
        turn_id: Math.max(1, Number(requestTurnId) || 1),
        text: payloadText,
        source_type: requestSourceType,
        metadata,
      });
      setResult(response);
      stopConsole(response);
      return { response, error: null };
    } catch (err) {
      const status = err.response?.status;
      const message = status === 408
        ? "Image OCR took too long. Try a smaller or clearer image."
        : status === 422
          ? "Could not parse that input for the selected source type."
          : status === 503
            ? "That source type is unavailable on this server."
            : "Inspection failed. Please try again.";
      if (notify) toast.error(message);
      stopConsole(null, true);
      return { response: null, error: message };
    } finally {
      const remainingMs = MIN_INSPECTION_FEEDBACK_MS - (performance.now() - startedAt);
      if (remainingMs > 0) await delay(remainingMs);
      setSubmitting(false);
    }
  };

  return {
    submitting,
    result,
    consoleEntries,
    progressStep,
    quote: INSPECTION_QUOTES[quoteIndex],
    inspectPayload,
    clearResult: () => setResult(null),
  };
}
