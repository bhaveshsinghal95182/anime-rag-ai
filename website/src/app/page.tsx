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
import { GlobeIcon, RefreshCcwIcon, CopyIcon } from "lucide-react";
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
        <div className="text-sm text-gray-600 mb-3">
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
            <div key={idx} className="bg-white p-3 rounded border">
              <div className="font-semibold">{animeData.title}</div>
              {animeData.englishTitle && animeData.englishTitle !== animeData.title && (
                <div className="text-sm text-gray-600">{animeData.englishTitle}</div>
              )}
              <div className="flex gap-4 text-sm text-gray-700 mt-1">
                {animeData.score && <span>⭐ {animeData.score}</span>}
                {animeData.episodes && <span>📺 {animeData.episodes} eps</span>}
                {animeData.type && <span>📱 {animeData.type}</span>}
                {animeData.year && <span>📅 {animeData.year}</span>}
                {animeData.rank && <span>🏆 #{animeData.rank}</span>}
              </div>
              {animeData.genres && (
                <div className="text-xs text-blue-600 mt-1">{animeData.genres}</div>
              )}
              {animeData.studios && (
                <div className="text-xs text-purple-600 mt-1">Studio: {animeData.studios}</div>
              )}
              {animeData.description && (
                <div className="text-xs text-gray-600 mt-2">{animeData.description}</div>
              )}
            </div>
          );
        })}
        
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 p-3 bg-gray-50 rounded-lg">
            <button
              onClick={prevPage}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              ← Previous
            </button>
            
            <div className="flex items-center space-x-2">
              {/* Show page numbers with ellipsis for large page counts */}
              {totalPages <= 7 ? (
                // Show all pages if 7 or fewer
                Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      page === currentPage
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border'
                    }`}
                  >
                    {page}
                  </button>
                ))
              ) : (
                // Show condensed pagination for many pages
                <>
                  {currentPage > 3 && (
                    <>
                      <button onClick={() => goToPage(1)} className="px-3 py-1 rounded text-sm font-medium bg-white text-gray-700 hover:bg-gray-100 border">1</button>
                      {currentPage > 4 && <span className="text-gray-500">...</span>}
                    </>
                  )}
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                    if (page > totalPages) return null;
                    return (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          page === currentPage
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  
                  {currentPage < totalPages - 2 && (
                    <>
                      {currentPage < totalPages - 3 && <span className="text-gray-500">...</span>}
                      <button onClick={() => goToPage(totalPages)} className="px-3 py-1 rounded text-sm font-medium bg-white text-gray-700 hover:bg-gray-100 border">{totalPages}</button>
                    </>
                  )}
                </>
              )}
            </div>

            <button
              onClick={nextPage}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              Next →
            </button>
          </div>
        )}
        
        {totalPages === 1 && results.length > 0 && (
          <div className="text-center text-sm text-gray-500 py-2">
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
                                <div className="text-xs text-blue-600 mb-2 font-medium">
                                  💭 AI Analysis & Recommendations:
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
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <h4 className="font-semibold text-blue-800 mb-2">
                                  {part.type === "tool-searchAnime" ? "🔍 Searching Anime" : "🎯 Filtering Anime"}
                                </h4>
                                {part.state === "input-streaming" && (
                                  <div className="text-blue-600">Processing request...</div>
                                )}
                                {part.state === "input-available" && (
                                  <div className="text-blue-600">
                                    <pre className="text-xs bg-blue-100 p-2 rounded">
                                      {JSON.stringify(part.input, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {part.state === "output-available" && (
                                  <div className="text-green-700">
                                    {typeof part.output === 'object' && part.output !== null ? (
                                      <div>
                                        <div className="font-medium mb-2">
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
                                      <pre className="text-xs bg-green-100 p-2 rounded overflow-auto">
                                        {JSON.stringify(part.output, null, 2)}
                                      </pre>
                                    )}
                                  </div>
                                )}
                                {part.state === "output-error" && (
                                  <div className="text-red-600">
                                    Error: {part.errorText}
                                  </div>
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
