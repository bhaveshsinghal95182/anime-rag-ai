"use client";

import React from "react";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputBody,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type Props = {
  onSubmit: (m: PromptInputMessage) => void;
  input: string;
  setInput: (s: string) => void;
  models: { name: string; value: string }[];
  model: string;
  setModel: (v: string) => void;
  status?: any;
};

export default function PromptInputForm({
  onSubmit,
  input,
  setInput,
  models,
  model,
  setModel,
  status,
}: Props) {
  return (
    <PromptInput onSubmit={onSubmit} className="mt-4" globalDrop multiple>
      <PromptInputBody>
        <PromptInputTextarea onChange={(e) => setInput(e.target.value)} value={input} />
      </PromptInputBody>
      <PromptInputToolbar>
        <PromptInputTools>
          <PromptInputModelSelect onValueChange={(value) => setModel(value)} value={model}>
            <Tooltip>
              <TooltipTrigger >
                <PromptInputModelSelectTrigger>
                  <PromptInputModelSelectValue />
                </PromptInputModelSelectTrigger>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>Only Gemini is available for now</TooltipContent>
            </Tooltip>
            <PromptInputModelSelectContent>
              {models.map((m) => (
                <PromptInputModelSelectItem key={m.value} value={m.value}>
                  {m.name}
                </PromptInputModelSelectItem>
              ))}
            </PromptInputModelSelectContent>
          </PromptInputModelSelect>
        </PromptInputTools>
        <PromptInputSubmit disabled={!input} status={status} />
      </PromptInputToolbar>
    </PromptInput>
  );
}
