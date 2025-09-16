"use client";

import { type PromptInputMessage } from "@/components/ai-elements/prompt-input";
import PromptInputForm from "@/components/ai-elements/prompt-input-form";
import { usePendingMessageStore } from "@/lib/store";
import Image from "next/image";
import {
  Announcement,
  AnnouncementTag,
  AnnouncementTitle,
} from "@/components/ui/shadcn-io/announcement";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Page() {
  const router = useRouter();
  const setPendingMessage = usePendingMessageStore((s) => s.setPendingMessage);
  const [input, setInput] = useState("");
  const models = [
    {
      name: "Gemini",
      value: "google/gemini-1.5-pro",
    },
  ];
  const [model, setModel] = useState<string>(models[0].value);
  // no chat status on main page; chat page will handle streaming/submitted state

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message?.text);
    const hasAttachments = Boolean(message?.files?.length);

    if (!(hasText || hasAttachments)) return;

    // Store message in zustand and navigate to chat where it will be sent
    setPendingMessage(message.text || "Sent with attachments");
    setInput("");
    router.push("/chat");
  };

  return (
    <div className=" grid grid-rows-5 h-screen relative">
      <Image
        src="/images/1.jpg"
        alt="Background collage of anime art"
        fill
        className="-z-20 object-cover"
        priority
      />
      <div className="flex justify-end">
        {/* <div className="w-[512px] h-[512px] bg-yellow-500/40 blur-3xl rounded-full mt-auto"></div> */}
      </div>
      <div className="flex justify-center flex-col font-sans">
        <div className=" w-full flex justify-center mb-4">
          <Announcement>
            <AnnouncementTag>27k+</AnnouncementTag>
            <AnnouncementTitle>
              Anime titles indexed in the chat bot{" "}
            </AnnouncementTitle>
          </Announcement>
        </div>
        <div className="relative w-full flex flex-col items-center">
          <p className="w-full text-center md:text-7xl text-4xl font-bold tracking-tighter text-foreground/80 flex flex-col items-center z-10">
            <span className="inline-flex items-baseline gap-4">
              <span>From</span>
              <span className="font-parisienne md:text-8xl text-5xl italic tracking-normal font-semibold h-fit">
                Classics
              </span>
            </span>

            <span className="inline-flex items-baseline gap-4 -translate-y-4">
              <span>to</span>
              <span className="font-parisienne md:text-8xl text-5xl tracking-normal font-semibold h-fit">
                hidden gems
              </span>
            </span>
          </p>
          <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/3 top-full mt-6 pointer-events-none z-0">
            <div className="rounded-full bg-white md:w-96 md:h-96 w-72 h-72 blur-[120px] opacity-60" />
          </div>
        </div>
      </div>
      <div className="flex justify-center items-center mt-4 gap-4">
        {/* <Button
          className="cursor-pointer"
          onClick={() => {
            setPendingMessage(
              "Recommend me some action anime like Attack on Titan"
            );
            setIsLoading(true);
            router.push("/chat");
          }}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="animate-spin" size="16" />
          ) : (
            <>
              Get recommendations{" "}
              <ArrowOutward size={16} className="inline-block align-middle" />
            </>
          )}
        </Button> */}
      </div>

      <div className="w-full flex justify-center">
        <div className="md:w-2xl w-[80%]">
          <PromptInputForm
            onSubmit={handleSubmit}
            input={input}
            setInput={setInput}
            models={models}
            model={model}
            setModel={setModel}
          />
        </div>
      </div>
    </div>
  );
}
