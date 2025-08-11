import React, { useEffect, useMemo, useRef, useState, memo } from 'react';
import { VariableSizeList as List } from 'react-window';
import {
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
} from '@tanstack/react-query';

// -----------------------------------------------------------------------------
// React‑Query bootstrap ─ create exactly **one** client for the browser tab
// -----------------------------------------------------------------------------
const queryClientSingleton: QueryClient =
  (globalThis as any)._kickclipsQueryClient ??
  new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false },
    },
  });
// ensure singleton across HMR in dev
(globalThis as any)._kickclipsQueryClient = queryClientSingleton;

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------
const FIVE_SEC = 5000;
const CHAT_ENDPOINT = (cid: number | string, iso: string) =>
  `/api/chat?cid=${cid}&t=${encodeURIComponent(iso)}`; // proxy inside Next.js api routes

const nextISO = (iso: string, ms = FIVE_SEC) =>
  new Date(new Date(iso).getTime() + ms).toISOString();

// -----------------------------------------------------------------------------
// Hook — fetch + stream messages
// -----------------------------------------------------------------------------
export interface ChatMessage {
  id: string; // unique per message
  timestamp: string; // ISO
  username: string;
  color: string; // RGB/HEX from payload
  badges: { url: string; alt: string }[];
  contentBlocks: (string | { emoteUrl: string; alt: string })[]; // text + emotes already split
  isReply?: boolean;
  replyMeta?: { user: string; preview: string };
}

interface UseChatOpts {
  channelId: number;
  clipStartISO: string;
  enabled: boolean; // visible & playing
}

export const useChannelChat = ({
  channelId,
  clipStartISO,
  enabled,
}: UseChatOpts) => {
  return useInfiniteQuery({
    queryKey: ['chat', channelId],
    enabled: !!channelId && enabled,
    refetchInterval: enabled ? FIVE_SEC : false,
    refetchIntervalInBackground: false,
    queryFn: async ({ pageParam = clipStartISO }) => {
      const res = await fetch(CHAT_ENDPOINT(channelId, pageParam));
      if (!res.ok) throw new Error('network');
      const data: ChatMessage[] = await res.json();
      return { data, next: nextISO(pageParam) };
    },
    getNextPageParam: (last) => last.next,
    retry: 2,
    retryDelay: 1500,
  });
};

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------
const ChatHeader = () => (
  <div className="relative flex items-center justify-between border-b-2 border-[#24272c] px-3.5 py-1.5 lg:min-h-[46px]">
    <button className="size-8 flex items-center justify-center rounded betterhover:hover:bg-surface-tint">
      {/* back arrow */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 32 32"
        fill="white"
        className="rotate-180"
      >
        <path d="M9 25.804L18.7962 16L9 6.19598L11.2038 4L23.2038 16L11.2038 28L9 25.804Z" />
      </svg>
    </button>
    <span className="absolute left-1/2 -translate-x-1/2 text-sm font-bold lg:text-base">
      Chat Replay
    </span>
    <button className="size-8 flex items-center justify-center rounded betterhover:hover:bg-surface-tint">
      <svg width="18" height="18" viewBox="0 0 32 32" fill="white">
        <path d="M9 25.804L18.7962 16L9 6.19598L11.2038 4L23.2038 16L11.2038 28L9 25.804Z" />
      </svg>
    </button>
  </div>
);

interface ChatMessageItemProps {
  msg: ChatMessage;
  style: React.CSSProperties;
}
const ChatMessageItem = memo(({ msg, style }: ChatMessageItemProps) => (
  <div
    style={style}
    className="px-2 lg:px-3 py-1 group betterhover:hover:bg-[#1b1d21] rounded-lg break-words w-full"
  >
    {msg.isReply && msg.replyMeta && (
      <div className="text-xs text-white/40 truncate mb-0.5">
        <svg
          width="16"
          height="16"
          viewBox="0 0 32 32"
          fill="currentColor"
          className="inline size-3 mr-1"
        />
        Replying to{' '}
        <span className="betterhover:hover:text-white/90 cursor-pointer">
          {msg.replyMeta.user}
        </span>
        : {msg.replyMeta.preview}
      </div>
    )}
    <span className="text-neutral text-[11px] font-semibold pr-1 align-middle">
      {msg.timestamp.slice(14, 19)}
    </span>
    {msg.badges.map((b) => (
      <img
        key={b.url}
        src={b.url}
        alt={b.alt}
        className="inline h-[1em] align-middle mr-0.5"
      />
    ))}
    <button className="font-bold mr-1" style={{ color: msg.color }}>
      {msg.username}
    </button>
    {msg.contentBlocks.map((blk, i) =>
      typeof blk === 'string' ? (
        <span key={i} className="font-normal">
          {blk}
        </span>
      ) : (
        <img
          key={i}
          src={blk.emoteUrl}
          alt={blk.alt}
          className="inline h-[1.2em] align-middle"
        />
      ),
    )}
  </div>
));
ChatMessageItem.displayName = 'ChatMessageItem';

interface ChatMessageListProps {
  messages: ChatMessage[];
  onBottomChange: (atBottom: boolean) => void;
}
const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  onBottomChange,
}) => {
  const listRef = useRef<List>(null);
  const itemSizes = useMemo(() => new Map<number, number>(), []);
  const getSize = (index: number) => itemSizes.get(index) ?? 56;
  const setSize = (index: number, size: number) => itemSizes.set(index, size);

  // keep pinned to bottom when new items arrive
  useEffect(() => {
    const el = (listRef.current?.outerRef ?? null) as HTMLDivElement | null;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (dist < 48) el.scrollTo({ top: el.scrollHeight });
  }, [messages.length]);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (ref.current) {
        setSize(index, ref.current.getBoundingClientRect().height);
        listRef.current?.resetAfterIndex(index);
      }
    }, [messages[index]]);
    return (
      <div ref={ref}>
        <ChatMessageItem msg={messages[index]} style={style} />
      </div>
    );
  };

  return (
    <List
      height={typeof window === 'undefined' ? 600 : window.innerHeight}
      itemCount={messages.length}
      itemSize={getSize}
      width="100%"
      ref={listRef}
      onScroll={({ scrollUpdateWasRequested }) => {
        if (scrollUpdateWasRequested) return; // programmatic scroll
        const rawRef = listRef.current?.outerRef;
        if (!rawRef || !(rawRef as any).scrollHeight) return; // outerRef not attached yet
        const el = rawRef as HTMLDivElement;
        const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
        onBottomChange(dist < 48);
      }}
    >
      {Row}
    </List>
  );
};

const ChatFooter: React.FC<{ onJump: () => void; show: boolean }> = ({
  onJump,
  show,
}) => (
  <div
    className={`absolute bottom-2 inset-x-0 flex justify-center transition-opacity ${
      show ? 'opacity-100' : 'opacity-0 pointer-events-none'
    }`}
  >
    <button
      onClick={onJump}
      className="px-3 py-1 bg-[#1b1d21] text-white text-xs rounded hover:bg-[#24272c]"
    >
      Jump to Live
    </button>
  </div>
);

// -----------------------------------------------------------------------------
// Inner sidebar (logic only) — wrapped by provider below
// -----------------------------------------------------------------------------
interface ChatSidebarInnerProps {
  channelId: number;
  clipStartISO: string;
  isPlaying: boolean;
  isVisible: boolean; // e.g. from IntersectionObserver
}

const ChatSidebarInner: React.FC<ChatSidebarInnerProps> = ({
  channelId,
  clipStartISO,
  isPlaying,
  isVisible,
}) => {
  const { data } = useChannelChat({
    channelId,
    clipStartISO,
    enabled: isPlaying && isVisible,
  });
  const messages = useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? [],
    [data],
  );
  const [atBottom, setAtBottom] = useState(true);

  return (
    <div className="flex flex-col h-full bg-[#111215] relative">
      <ChatHeader />
      <ChatMessageList messages={messages} onBottomChange={setAtBottom} />
      <ChatFooter show={!atBottom} onJump={() => setAtBottom(true)} />
    </div>
  );
};

// -----------------------------------------------------------------------------
// Exported component – ensures QueryClientProvider exists
// -----------------------------------------------------------------------------
interface ChatSidebarProps extends ChatSidebarInnerProps {}

const ChatSidebar: React.FC<ChatSidebarProps> = (props) => (
  <QueryClientProvider client={queryClientSingleton}>
    <ChatSidebarInner {...props} />
  </QueryClientProvider>
);

export default ChatSidebar;
