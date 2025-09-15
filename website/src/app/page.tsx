"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  type PromptInputMessage,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Actions, Action } from "@/components/ai-elements/actions";
import { Fragment, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Response } from "@/components/ai-elements/response";
import { RefreshCcwIcon, CopyIcon } from "lucide-react";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Loader } from "@/components/ai-elements/loader";
import { Button } from "@/components/ui/button";

const models = [
  {
    name: "Gemini",
    value: "google/gemini-1.5-pro",
  }
];

const ChatBotDemo = () => {
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(models[0].value);
  const [toolPagination, setToolPagination] = useState<Record<string, number>>({});
  const { messages, sendMessage, status, regenerate } = useChat();

  const AnimeResultsPaginated = ({ 
    results, 
    toolCallId 
  }: { 
    results: unknown[]; 
    toolCallId: string; 
  }) => {
    const currentPage = toolPagination[toolCallId] || 1;
    const itemsPerPage = 10;
    const totalPages = Math.ceil(results.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const visibleResults = results.slice(startIndex, endIndex);

    const goToPage = (page: number) => {
      setToolPagination(prev => ({
        ...prev,
        [toolCallId]: page
      }));
    };

    const nextPage = () => {
      if (currentPage < totalPages) {
        goToPage(currentPage + 1);
      }
    };

    const prevPage = () => {
      if (currentPage > 1) {
        goToPage(currentPage - 1);
      }
    };

    return (
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground mb-3">
          Page {currentPage} of {totalPages} (Showing {startIndex + 1}-{Math.min(endIndex, results.length)} of {results.length} results)
        </div>
        {visibleResults.map((anime: unknown, idx: number) => {
          const animeData = anime as {
            title?: string;
            englishTitle?: string;
            score?: number;
            episodes?: number;
            type?: string;
            year?: string;
            genres?: string;
            description?: string;
            rank?: number;
            popularity?: number;
            studios?: string;
            status?: string;
          };
          
          return (
            <div key={idx} className="bg-background p-3 rounded-md border shadow-sm">
              <div className="font-semibold text-foreground">{animeData.title}</div>
              {animeData.englishTitle && animeData.englishTitle !== animeData.title && (
                <div className="text-sm text-muted-foreground">{animeData.englishTitle}</div>
              )}
              <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                {animeData.score && <span>{animeData.score}</span>}
                {animeData.episodes && <span>{animeData.episodes} eps</span>}
                {animeData.type && <span>{animeData.type}</span>}
                {animeData.year && <span>{animeData.year}</span>}
                {animeData.rank && <span>#{animeData.rank}</span>}
              </div>
              {animeData.genres && (
                <div className="text-xs text-muted-foreground/80 mt-1">{animeData.genres}</div>
              )}
              {animeData.studios && (
                <div className="text-xs text-muted-foreground/80 mt-1">Studio: {animeData.studios}</div>
              )}
              {animeData.description && (
                <div className="text-xs text-muted-foreground mt-2">{animeData.description}</div>
              )}
            </div>
          );
        })}
        
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 p-3 bg-muted rounded-lg">
            <Button onClick={prevPage} disabled={currentPage === 1} className="px-4 py-2">
              ← Previous
            </Button>
            
            <div className="flex items-center space-x-2">
              {/* Show page numbers with ellipsis for large page counts */}
              {totalPages <= 7 ? (
                // Show all pages if 7 or fewer
                Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      page === currentPage
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {page}
                  </Button>
                ))
              ) : (
                // Show condensed pagination for many pages
                <>
                  {currentPage > 3 && (
                    <>
                      <Button onClick={() => goToPage(1)} className="px-3 py-1 rounded text-sm font-medium bg-card text-muted-foreground hover:bg-secondary">1</Button>
                      {currentPage > 4 && <span className="text-muted-foreground">...</span>}
                    </>
                  )}
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                    if (page > totalPages) return null;
                    return (
                      <Button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          page === currentPage
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card text-muted-foreground hover:bg-secondary'
                        }`}
                      >
                        {page}
                      </Button>
                    );
                  })}
                  
                  {currentPage < totalPages - 2 && (
                    <>
                      {currentPage < totalPages - 3 && <span className="text-muted-foreground">...</span>}
                      <Button onClick={() => goToPage(totalPages)} className="px-3 py-1 rounded text-sm font-medium bg-card text-muted-foreground hover:bg-secondary">{totalPages}</Button>
                    </>
                  )}
                </>
              )}
            </div>

            <Button onClick={nextPage} disabled={currentPage === totalPages} className="px-4 py-2">
              Next →
            </Button>
          </div>
        )}
        
        {totalPages === 1 && results.length > 0 && (
          <div className="text-center text-sm text-muted-foreground py-2">
            Showing all {results.length} results
          </div>
        )}
      </div>
    );
  };

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    sendMessage(
      {
        text: message.text || "Sent with attachments",
        files: message.files,
      },
      {
        body: {
          model: model
        },
      }
    );
    setInput("");
  };

  return (
    <div className="max-w-4xl mx-auto p-6 relative size-full h-screen">
      <div className="flex flex-col h-full">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === "assistant" &&
                  message.parts.filter((part) => part.type === "source-url")
                    .length > 0 && (
                    <Sources>
                      <SourcesTrigger
                        count={
                          message.parts.filter(
                            (part) => part.type === "source-url"
                          ).length
                        }
                      />
                      {message.parts
                        .filter((part) => part.type === "source-url")
                        .map((part, i) => (
                          <SourcesContent key={`${message.id}-${i}`}>
                            <Source
                              key={`${message.id}-${i}`}
                              href={part.url}
                              title={part.url}
                            />
                          </SourcesContent>
                        ))}
                    </Sources>
                  )}
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case "text":
                      const isFollowUpAfterTool = i > 0 && message.parts.slice(0, i).some(p => 
                        p.type === "tool-searchAnime" || p.type === "tool-filterAnime"
                      );
                      
                      return (
                        <Fragment key={`${message.id}-${i}`}>
                          <Message from={message.role}>
                            <MessageContent>
                              {isFollowUpAfterTool && (
                                <div className="text-xs text-muted-foreground mb-2 font-medium">
                                  AI analysis & recommendations:
                                </div>
                              )}
                              <Response>{part.text}</Response>
                            </MessageContent>
                          </Message>
                                {message.role === "assistant" &&
                            i === message.parts.length - 1 && (
                              <Actions className="mt-2">
                                <Action
                                  onClick={() => regenerate()}
                                  label="Retry"
                                >
                                  <RefreshCcwIcon className="size-3" />
                                </Action>
                                <Action
                                  onClick={() =>
                                    navigator.clipboard.writeText(part.text)
                                  }
                                  label="Copy"
                                >
                                  <CopyIcon className="size-3" />
                                </Action>
                              </Actions>
                            )}
                        </Fragment>
                      );
                    case "reasoning":
                      return (
                        <Reasoning
                          key={`${message.id}-${i}`}
                          className="w-full"
                          isStreaming={
                            status === "streaming" &&
                            i === message.parts.length - 1 &&
                            message.id === messages.at(-1)?.id
                          }
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      );
                    case "tool-searchAnime":
                    case "tool-filterAnime":
                      return (
                        <Fragment key={`${message.id}-${i}`}>
                          <Message from={message.role}>
                            <MessageContent>
                              <div className="bg-card border rounded-lg p-4 mb-4">
                                <h4 className="font-semibold mb-2 text-base text-foreground">
                                  {part.type === "tool-searchAnime" ? "Searching anime" : "Filtering anime"}
                                </h4>
                                {part.state === "input-streaming" && (
                                  <div className="text-muted-foreground">Processing request...</div>
                                )}
                                {part.state === "input-available" && (
                                  <div className="text-muted-foreground">
                                    <pre className="text-xs bg-muted p-2 rounded">
                                      {JSON.stringify(part.input, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {part.state === "output-available" && (
                                  <div className="text-foreground">
                                    {typeof part.output === 'object' && part.output !== null ? (
                                      <div>
                                        <div className="font-medium mb-2 text-foreground">
                                          {(part.output as { message?: string }).message}
                                        </div>
                                        {(part.output as { results?: unknown[]; totalCount?: number }).results && Array.isArray((part.output as { results?: unknown[] }).results) && (
                                          <AnimeResultsPaginated 
                                            results={(part.output as { results: unknown[] }).results}
                                            toolCallId={`${message.id}-${i}`}
                                          />
                                        )}
                                      </div>
                                    ) : (
                                      <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                                        {JSON.stringify(part.output, null, 2)}
                                      </pre>
                                    )}
                                  </div>
                                )}
                                {part.state === "output-error" && (
                                  <div className="text-destructive">Error: {part.errorText}</div>
                                )}
                              </div>
                            </MessageContent>
                          </Message>
                        </Fragment>
                      );
                    default:
                      return null;
                  }
                })}
              </div>
            ))}
            {status === "submitted" && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <PromptInput
          onSubmit={handleSubmit}
          className="mt-4"
          globalDrop
          multiple
        >
          <PromptInputBody>
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
            </PromptInputAttachments>
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
            />
          </PromptInputBody>
          <PromptInputToolbar>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              <PromptInputModelSelect
                onValueChange={(value) => {
                  setModel(value);
                }}
                value={model}
              >
                <PromptInputModelSelectTrigger>
                  <PromptInputModelSelectValue />
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent>
                  {models.map((model) => (
                    <PromptInputModelSelectItem
                      key={model.value}
                      value={model.value}
                    >
                      {model.name}
                    </PromptInputModelSelectItem>
                  ))}
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>
            </PromptInputTools>
            <PromptInputSubmit
              disabled={!input && status !== "submitted"}
              status={status}
            />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
};

export default ChatBotDemo;
