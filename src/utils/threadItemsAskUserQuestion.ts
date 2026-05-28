import type { ConversationItem } from "../types";
import i18n from "../i18n";

type AskUserQuestionOption = {
  label: string;
  description: string;
};

type AskUserQuestionTemplate = {
  id: string;
  header: string;
  question: string;
  options?: AskUserQuestionOption[];
};

type AskUserQuestionAnswer = {
  selectedOptions: string[];
  note: string;
};

type AskUserQuestionAnswerParseResult = {
  rawSelectionText: string;
  answers: AskUserQuestionAnswer[];
  answersByQuestionId: Record<string, AskUserQuestionAnswer>;
};

const ASK_USER_QUESTION_DISMISSED_TEXT_REGEX =
  /^The user dismissed the question without selecting an option\.?$/i;
const ASK_USER_QUESTION_SKIPPED_TEXT_REGEX =
  /^The user skipped this AskUserQuestion without selecting an option\.\s*Do not ask the same question again;\s*continue the original task using the available context and reasonable assumptions\.?$/i;
const ASK_USER_QUESTION_PARTIAL_SKIP_TEXT_REGEX =
  /^The user answered the AskUserQuestion[:：]\s*([\s\S]*?)[。.]?\s*The user skipped \d+ remaining question\(s\) without selecting an option\.\s*Do not ask the skipped question\(s\) again;\s*continue the original task using the available context and reasonable assumptions\.?$/i;
const ASK_USER_QUESTION_RESULT_BASE64_REGEX =
  /\bAskUserQuestionResultBase64:([A-Za-z0-9+/=]+)/;

function asString(value: unknown) {
  return typeof value === "string" ? value : value ? String(value) : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseJsonRecordFromText(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function isAskUserQuestionToolItem(
  item: Extract<ConversationItem, { kind: "tool" }>,
) {
  const toolType = asString(item.toolType).trim().toLowerCase();
  if (toolType === "askuserquestion" || toolType === "ask_user_question") {
    return true;
  }
  const title = asString(item.title).toLowerCase();
  if (title.includes("askuserquestion") || title.includes("ask_user_question")) {
    return true;
  }
  if (toolType === "mcptoolcall") {
    return title.includes("askuserquestion") || title.includes("ask_user_question");
  }
  return false;
}

function parseAskUserQuestionTemplatesFromDetail(
  detail: string,
): AskUserQuestionTemplate[] {
  const record = parseJsonRecordFromText(detail);
  if (!record) {
    return [];
  }
  const hasSingleQuestionShape =
    "question" in record ||
    "prompt" in record ||
    "header" in record ||
    "title" in record ||
    "options" in record;
  const rawQuestions = Array.isArray(record.questions)
    ? record.questions
    : hasSingleQuestionShape
      ? [record]
      : [];
  const templates: AskUserQuestionTemplate[] = [];
  rawQuestions.forEach((entry, index) => {
    const question = asRecord(entry);
    if (!question) {
      return;
    }
    const id = asString(question.id ?? `q-${index}`).trim() || `q-${index}`;
    const header = asString(question.header ?? question.title ?? "").trim();
    const questionText = asString(question.question ?? question.prompt ?? "").trim();
    const rawOptions = Array.isArray(question.options) ? question.options : [];
    const options = rawOptions
      .map((rawOption) => {
        const option = asRecord(rawOption);
        if (!option) {
          return null;
        }
        const label = asString(option.label ?? "").trim();
        const description = asString(option.description ?? "").trim();
        if (!label && !description) {
          return null;
        }
        return { label, description };
      })
      .filter((option): option is AskUserQuestionOption => option !== null);
    if (!questionText && options.length === 0) {
      return;
    }
    templates.push({
      id,
      header,
      question: questionText,
      options: options.length > 0 ? options : undefined,
    });
  });
  return templates;
}

function parseAskUserAnswerParts(raw: string): AskUserQuestionAnswer {
  const segments = raw
    .split(/[,，、]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const selectedOptions: string[] = [];
  let note = "";
  for (const segment of segments) {
    if (/^user_note\s*:/i.test(segment)) {
      const parsedNote = segment.replace(/^user_note\s*:/i, "").trim();
      if (parsedNote) {
        note = parsedNote;
      }
      continue;
    }
    selectedOptions.push(segment);
  }
  return { selectedOptions, note };
}

function decodeBase64JsonRecord(base64Value: string): Record<string, unknown> | null {
  try {
    const binary = globalThis.atob(base64Value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const jsonText = new TextDecoder().decode(bytes);
    return parseJsonRecordFromText(jsonText);
  } catch {
    return null;
  }
}

function parseStructuredAnswerResult(
  text: string,
  templates: AskUserQuestionTemplate[],
): AskUserQuestionAnswerParseResult | null {
  const markerMatch = text.match(ASK_USER_QUESTION_RESULT_BASE64_REGEX);
  if (!markerMatch) {
    return null;
  }
  const payload = decodeBase64JsonRecord(asString(markerMatch[1]));
  const answersRecord = asRecord(payload?.answers);
  if (!answersRecord) {
    return null;
  }
  const templateIds = new Set(templates.map((template) => template.id));
  const answersByQuestionId: Record<string, AskUserQuestionAnswer> = {};
  const displayParts: string[] = [];
  Object.entries(answersRecord).forEach(([questionId, rawAnswers]) => {
    if (!templateIds.has(questionId) || !Array.isArray(rawAnswers)) {
      return;
    }
    const answerValues = rawAnswers
      .map((value) => asString(value).trim())
      .filter(Boolean);
    if (answerValues.length === 0) {
      return;
    }
    const answerText = answerValues.join(", ");
    answersByQuestionId[questionId] = parseAskUserAnswerParts(answerText);
    displayParts.push(answerText);
  });
  if (Object.keys(answersByQuestionId).length === 0) {
    return null;
  }
  return {
    rawSelectionText: displayParts.join("; "),
    answers: [],
    answersByQuestionId,
  };
}

function parseAskUserAnswerSegments(
  rawSelectionText: string,
  templates: AskUserQuestionTemplate[],
) {
  const templateIds = new Set(templates.map((template) => template.id));
  const baseSegments = rawSelectionText
    .split(/[;；]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const answersByQuestionId: Record<string, AskUserQuestionAnswer> = {};
  const positionalAnswerSegments: string[] = [];
  for (const segment of baseSegments) {
    const keyedMatch = segment.match(/^([A-Za-z0-9_.:-]+)\s*=\s*([\s\S]*)$/);
    if (keyedMatch) {
      const questionId = asString(keyedMatch[1]).trim();
      const answerText = asString(keyedMatch[2]).trim();
      if (templateIds.has(questionId)) {
        answersByQuestionId[questionId] = parseAskUserAnswerParts(answerText);
        continue;
      }
    }
    positionalAnswerSegments.push(segment);
  }
  return {
    answersByQuestionId,
    positionalAnswerSegments,
    displaySelectionText: baseSegments
      .map((segment) => {
        const keyedMatch = segment.match(/^([A-Za-z0-9_.:-]+)\s*=\s*([\s\S]*)$/);
        if (!keyedMatch) {
          return segment;
        }
        const questionId = asString(keyedMatch[1]).trim();
        return templateIds.has(questionId) ? asString(keyedMatch[2]).trim() : segment;
      })
      .filter(Boolean)
      .join("; "),
  };
}

function parseAskUserQuestionAnswerText(
  text: string,
  templates: AskUserQuestionTemplate[],
): AskUserQuestionAnswerParseResult | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  if (
    ASK_USER_QUESTION_DISMISSED_TEXT_REGEX.test(trimmed) ||
    ASK_USER_QUESTION_SKIPPED_TEXT_REGEX.test(trimmed)
  ) {
    return {
      rawSelectionText: "",
      answers: [{ selectedOptions: [], note: "" }],
      answersByQuestionId: {},
    };
  }
  const structuredResult = parseStructuredAnswerResult(trimmed, templates);
  if (structuredResult) {
    return structuredResult;
  }
  const answeredMatch =
    trimmed.match(ASK_USER_QUESTION_PARTIAL_SKIP_TEXT_REGEX) ??
    trimmed.match(
      /^The user answered the AskUserQuestion[:：]\s*([\s\S]*?)(?:[。.]?\s*Please continue based on this selection\.?)$/i,
    );
  if (!answeredMatch) {
    return null;
  }
  const rawSelectionText = asString(answeredMatch[1] ?? "").trim();
  if (!rawSelectionText) {
    return null;
  }
  const {
    answersByQuestionId,
    positionalAnswerSegments,
    displaySelectionText,
  } = parseAskUserAnswerSegments(rawSelectionText, templates);
  if (
    positionalAnswerSegments.length === 0 &&
    Object.keys(answersByQuestionId).length === 0
  ) {
    return null;
  }
  return {
    rawSelectionText: displaySelectionText,
    answers: positionalAnswerSegments.map((segment) => parseAskUserAnswerParts(segment)),
    answersByQuestionId,
  };
}

function buildRequestUserInputSubmittedDetail(
  templates: AskUserQuestionTemplate[],
  parsedAnswer: AskUserQuestionAnswerParseResult,
) {
  const payload = {
    schema: "requestUserInputSubmitted/v1",
    submittedAt: Date.now(),
    questions: templates.map((template, index) => ({
      id: template.id || `q-${index}`,
      header: template.header,
      question: template.question,
      options: template.options,
      selectedOptions:
        parsedAnswer.answersByQuestionId[template.id]?.selectedOptions ??
        parsedAnswer.answers[index]?.selectedOptions ??
        [],
      note:
        parsedAnswer.answersByQuestionId[template.id]?.note ??
        parsedAnswer.answers[index]?.note ??
        "",
    })),
  };
  return JSON.stringify(payload);
}

export function normalizeAskUserQuestionHistoryItems(items: ConversationItem[]) {
  if (items.length === 0) {
    return items;
  }
  const normalized: ConversationItem[] = [];
  const askToolOrder: string[] = [];
  const askTemplatesByToolId = new Map<string, AskUserQuestionTemplate[]>();
  const askToolIndexById = new Map<string, number>();
  const existingSubmittedToolIds = new Set<string>();

  for (const item of items) {
    if (item.kind === "tool" && item.toolType === "requestUserInputSubmitted") {
      const submittedId = item.id;
      const prefix = "request-user-input-submitted-";
      if (submittedId.startsWith(prefix) && submittedId.length > prefix.length) {
        existingSubmittedToolIds.add(submittedId.slice(prefix.length));
      }
    }
  }

  const consumeAskToolId = () => {
    while (askToolOrder.length > 0) {
      const candidate = askToolOrder.shift() ?? "";
      if (!candidate) {
        continue;
      }
      return candidate;
    }
    return "";
  };
  const peekAskToolId = () => {
    while (askToolOrder.length > 0) {
      const candidate = askToolOrder[0] ?? "";
      if (!candidate) {
        askToolOrder.shift();
        continue;
      }
      return candidate;
    }
    return "";
  };

  for (const item of items) {
    if (item.kind === "tool" && isAskUserQuestionToolItem(item)) {
      askToolOrder.push(item.id);
      askTemplatesByToolId.set(item.id, parseAskUserQuestionTemplatesFromDetail(item.detail));
      askToolIndexById.set(item.id, normalized.length);
      normalized.push(item);
      continue;
    }

    if (item.kind === "message" && item.role === "user") {
      const pendingToolId = peekAskToolId();
      const pendingTemplates = pendingToolId
        ? askTemplatesByToolId.get(pendingToolId) ?? []
        : [];
      const parsedAnswer = pendingToolId
        ? parseAskUserQuestionAnswerText(item.text, pendingTemplates)
        : null;
      if (parsedAnswer) {
        const matchedToolId = consumeAskToolId();
        if (matchedToolId) {
          const askToolIndex = askToolIndexById.get(matchedToolId);
          if (askToolIndex !== undefined) {
            const askItem = normalized[askToolIndex];
            if (askItem?.kind === "tool") {
              normalized[askToolIndex] = {
                ...askItem,
                status: "completed",
                output: parsedAnswer.rawSelectionText || askItem.output,
              };
            }
          }
          if (!existingSubmittedToolIds.has(matchedToolId)) {
            const templates = askTemplatesByToolId.get(matchedToolId) ?? [];
            normalized.push({
              id: `request-user-input-submitted-${matchedToolId}`,
              kind: "tool",
              toolType: "requestUserInputSubmitted",
              title: i18n.t("approval.inputRequested"),
              detail: buildRequestUserInputSubmittedDetail(templates, parsedAnswer),
              status: "completed",
              output: parsedAnswer.rawSelectionText,
            });
          }
          continue;
        }
      }
    }

    normalized.push(item);
  }

  return normalized;
}
