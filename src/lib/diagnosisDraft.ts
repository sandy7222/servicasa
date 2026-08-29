import type { AssistantDraft } from './diagnosisAssistant';

export const ASSISTANT_DRAFT_KEY = 'tecniurbano_assistantDraft';

export const ASSISTANT_DRAFT_EVENT = 'tecniurbano-assistant-draft';

export function saveAssistantDraft(draft: AssistantDraft) {
  sessionStorage.setItem(ASSISTANT_DRAFT_KEY, JSON.stringify(draft));
  window.dispatchEvent(new CustomEvent(ASSISTANT_DRAFT_EVENT, { detail: draft }));
}

export function readAssistantDraft(): AssistantDraft | null {
  try {
    const raw = sessionStorage.getItem(ASSISTANT_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AssistantDraft;
  } catch {
    return null;
  }
}

export function clearAssistantDraft() {
  sessionStorage.removeItem(ASSISTANT_DRAFT_KEY);
}

export function consumeAssistantDraft(): AssistantDraft | null {
  const draft = readAssistantDraft();
  if (draft) clearAssistantDraft();
  return draft;
}

export function hasAssistantDraft(): boolean {
  return Boolean(sessionStorage.getItem(ASSISTANT_DRAFT_KEY));
}
